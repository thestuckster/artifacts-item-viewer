const API_BASE = 'https://api.artifactsmmo.com/items';
let allItems = [];

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const spinner = document.getElementById('spinner');
const itemInfo = document.getElementById('itemInfo');
const graphDiv = document.getElementById('graph');
const autocompleteList = document.getElementById('autocomplete-list');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const breadcrumbs = document.getElementById('breadcrumbs');

let historyStack = [];
let historyPointer = -1;
let breadcrumbTrail = [];

async function fetchAllItems() {
    let items = [];
    let page = 1;
    let pages = 1;
    while (page <= pages) {
        const res = await fetch(`${API_BASE}?page=${page}&size=100`);
        const data = await res.json();
        items = items.concat(data.data);
        pages = data.pages || 1;
        page++;
    }
    return items;
}

function showSpinner(show) {
    spinner.style.display = show ? 'block' : 'none';
}

function showPopup(message) {
    const popup = document.createElement('div');
    popup.className = 'modal fade show';
    popup.style.display = 'block';
    popup.innerHTML = `<div class='modal-dialog'><div class='modal-content'><div class='modal-header'><h5 class='modal-title'>Notice</h5></div><div class='modal-body'>${message}</div><div class='modal-footer'><button class='btn btn-primary' id='closePopup'>Close</button></div></div></div>`;
    document.body.appendChild(popup);
    document.getElementById('closePopup').onclick = () => {
        popup.classList.remove('show');
        popup.style.display = 'none';
        document.body.removeChild(popup);
    };
}

function displayItemInfo(item) {
    // Find all items that use this item as a crafting material
    let usedIn = [];
    if (allItems && allItems.length) {
        usedIn = allItems.filter(other =>
            other.craft && other.craft.items && other.craft.items.some(comp => comp.code === item.code)
        );
    }
    let usedInHtml = '';
    if (usedIn.length > 0) {
        const maxToShow = 5;
        const first = usedIn.slice(0, maxToShow);
        const rest = usedIn.slice(maxToShow);
        usedInHtml = `<div class='mt-3'><strong>Crafting material for:</strong><ul class='mb-0' id='usedInList'>` +
            first.map(u => `<li><a href="#" class="craft-used-in" data-name="${u.name}">${u.name}</a></li>`).join('') +
            `</ul>`;
        if (rest.length > 0) {
            usedInHtml += `<a href="#" id="showMoreUsedIn" class="d-block mt-1">Show more (${rest.length} more)</a>`;
            usedInHtml += `<ul class='mb-0 d-none' id='usedInListMore'>` +
                rest.map(u => `<li><a href="#" class="craft-used-in" data-name="${u.name}">${u.name}</a></li>`).join('') +
                `</ul>`;
            usedInHtml += `<a href="#" id="showLessUsedIn" class="d-block mt-1 d-none">Show less</a>`;
        }
        usedInHtml += `</div>`;
    }
    const imgUrl = `https://www.artifactsmmo.com/images/items/${item.code}.png`;
    itemInfo.innerHTML = `<div class="card"><div class="card-body">
        <div class="d-flex align-items-center mb-3">
            <img src="${imgUrl}" alt="${item.name}" style="max-width:64px;max-height:64px;" class="me-3" onerror="this.style.display='none'">
            <h3 class="mb-0">${item.name}</h3>
        </div>
        <p><strong>Type:</strong> ${item.type || ''} ${item.subtype || ''}</p>
        <p><strong>Level:</strong> ${item.level || ''}</p>
        <p><strong>Description:</strong> ${item.description || ''}</p>
        <p><strong>Tradeable:</strong> ${item.tradeable ? 'Yes' : 'No'}</p>
        ${item.effects && item.effects.length ? `<p><strong>Effects:</strong> ${item.effects.map(e => `${e.code}: ${e.value}`).join(', ')}</p>` : ''}
        ${item.craft ? `<p><strong>Craft Skill:</strong> ${item.craft.skill} (Level ${item.craft.level})</p>` : ''}
        <div id='exchangeData' class='mt-3'></div>
        ${usedInHtml}
    </div></div>`;
    fetchExchangeData(item.code);
    // Add click handlers for used-in links
    document.querySelectorAll('.craft-used-in').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const name = this.getAttribute('data-name');
            searchInput.value = name;
            searchAndDisplayItem(name, {resetBreadcrumb: true});
        });
    });
    // Show more/less functionality
    const showMore = document.getElementById('showMoreUsedIn');
    const showLess = document.getElementById('showLessUsedIn');
    const usedInListMore = document.getElementById('usedInListMore');
    if (showMore && showLess && usedInListMore) {
        showMore.addEventListener('click', function(e) {
            e.preventDefault();
            usedInListMore.classList.remove('d-none');
            showMore.classList.add('d-none');
            showLess.classList.remove('d-none');
        });
        showLess.addEventListener('click', function(e) {
            e.preventDefault();
            usedInListMore.classList.add('d-none');
            showMore.classList.remove('d-none');
            showLess.classList.add('d-none');
            // Optional: scroll list into view
            const usedInList = document.getElementById('usedInList');
            if (usedInList) usedInList.scrollIntoView({behavior:'smooth', block:'nearest'});
        });
    }
}

async function fetchExchangeData(code) {
    const exDiv = document.getElementById('exchangeData');
    exDiv.innerHTML = `<strong>Grand Exchange Data:</strong> <span class='text-muted'>Loading...</span>`;
    try {
        const res = await fetch(`https://api.artifactsmmo.com/grandexchange/history/${code}`);
        const data = await res.json();
        if (!data.data || data.data.length === 0) {
            exDiv.innerHTML = `<strong>Grand Exchange Data:</strong> <span class='text-muted'>No sales history.</span>`;
            return;
        }
        // Sort by sold_at desc
        const sorted = data.data.slice().sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));
        const last = sorted[0];
        const avg = (sorted.reduce((sum, e) => sum + (e.price || 0), 0) / sorted.length).toFixed(2);
        let html = `<strong>Grand Exchange Data:</strong><ul class='mb-0'>`;
        html += `<li><strong>Last Sold:</strong> ${new Date(last.sold_at).toLocaleString()} for <strong>${last.price}</strong> gp</li>`;
        if (sorted.length > 1) {
            html += `<li><strong>Average Sell Price:</strong> ${avg} gp (${sorted.length} sales)</li>`;
        }
        html += `</ul>`;
        exDiv.innerHTML = html;
    } catch (e) {
        exDiv.innerHTML = `<strong>Grand Exchange Data:</strong> <span class='text-danger'>Error loading data.</span>`;
    }
}

async function searchAndDisplayItem(name, options = {}) {
    // options: {fromHistory: bool, fromBreadcrumb: bool, resetBreadcrumb: bool}
    showSpinner(true);
    if (!allItems.length) allItems = await fetchAllItems();
    const item = allItems.find(i => i.name.toLowerCase() === name.toLowerCase());
    showSpinner(false);
    if (!item) {
        showPopup('Item not found!');
        itemInfo.innerHTML = '';
        graphDiv.innerHTML = '';
        return;
    }
    displayItemInfo(item);
    buildCraftTree(item);
    // History management
    if (options.resetBreadcrumb) {
        historyStack = [name];
        historyPointer = 0;
    } else if (!options.fromHistory) {
        // If not navigating via back/forward, add to history
        if (historyPointer < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyPointer + 1);
        }
        historyStack.push(name);
        historyPointer = historyStack.length - 1;
    }
    // Breadcrumb management
    if (options.resetBreadcrumb) {
        breadcrumbTrail = [name];
    } else if (!options.fromBreadcrumb) {
        breadcrumbTrail = historyStack.slice(0, historyPointer + 1);
    }
    renderHistoryUI();
}

function renderHistoryUI() {
    // Back/forward buttons
    backBtn.disabled = historyPointer <= 0;
    forwardBtn.disabled = historyPointer >= historyStack.length - 1;
    // Breadcrumbs
    breadcrumbs.innerHTML = '';
    breadcrumbTrail.forEach((name, idx) => {
        const li = document.createElement('li');
        li.className = 'breadcrumb-item' + (idx === breadcrumbTrail.length - 1 ? ' active' : '');
        if (idx === breadcrumbTrail.length - 1) {
            li.setAttribute('aria-current', 'page');
            li.textContent = name;
        } else {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = name;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                historyPointer = idx;
                searchInput.value = name;
                searchAndDisplayItem(name, {fromHistory: true, fromBreadcrumb: true});
            });
            li.appendChild(a);
        }
        breadcrumbs.appendChild(li);
    });
}

backBtn.onclick = function() {
    if (historyPointer > 0) {
        historyPointer--;
        const name = historyStack[historyPointer];
        searchInput.value = name;
        searchAndDisplayItem(name, {fromHistory: true});
    }
};
forwardBtn.onclick = function() {
    if (historyPointer < historyStack.length - 1) {
        historyPointer++;
        const name = historyStack[historyPointer];
        searchInput.value = name;
        searchAndDisplayItem(name, {fromHistory: true});
    }
};


searchBtn.onclick = () => {
    const name = searchInput.value.trim();
    if (name) searchAndDisplayItem(name);
};

// --- Autocomplete logic ---
let currentFocus = -1;
searchInput.addEventListener('input', async function(e) {
    const val = this.value;
    autocompleteList.innerHTML = '';
    if (!val) return;
    if (!allItems.length) allItems = await fetchAllItems();
    const matches = allItems.filter(i => i.name.toLowerCase().includes(val.toLowerCase())).slice(0, 10);
    matches.forEach((item, idx) => {
        const itemDiv = document.createElement('button');
        itemDiv.type = 'button';
        itemDiv.className = 'list-group-item list-group-item-action';
        itemDiv.innerHTML = item.name.replace(new RegExp(val, 'gi'), match => `<strong>${match}</strong>`);
        // Custom event for keyboard selection
        itemDiv.addEventListener('autocompleteSelect', function(e) {
            searchInput.value = item.name;
            autocompleteList.innerHTML = '';
            searchAndDisplayItem(item.name, {resetBreadcrumb: true});
        });
        // Mouse selection
        itemDiv.addEventListener('mousedown', function(e) {
            e.preventDefault();
            searchInput.value = item.name;
            autocompleteList.innerHTML = '';
            searchAndDisplayItem(item.name, {resetBreadcrumb: true});
        });
        autocompleteList.appendChild(itemDiv);
    });
    currentFocus = -1;
});

searchInput.addEventListener('keydown', function(e) {
    const items = autocompleteList.getElementsByTagName('button');
    if (e.key === 'ArrowDown') {
        currentFocus++;
        addActive(items);
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        currentFocus--;
        addActive(items);
        e.preventDefault();
    } else if (e.key === 'Enter') {
        if (currentFocus > -1 && items[currentFocus]) {
            // simulate click but with resetBreadcrumb
            e.preventDefault();
            items[currentFocus].dispatchEvent(new CustomEvent('autocompleteSelect', {bubbles: true}));
        } else {
            const name = searchInput.value.trim();
            if (name) searchAndDisplayItem(name, {resetBreadcrumb: true});
        }
    }
});

function addActive(items) {
    if (!items) return;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active');
    items[currentFocus].scrollIntoView({block: 'nearest'});
}
function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
    }
}
document.addEventListener('click', function (e) {
    if (e.target !== searchInput) autocompleteList.innerHTML = '';
});
// --- End autocomplete ---

function buildCraftTree(rootItem) {
    // Clear existing graph
    graphDiv.innerHTML = '';
    // Build tree data
    const nodes = [];
    const links = [];
    const codeToItem = Object.fromEntries(allItems.map(i => [i.code, i]));
    let nodeId = 0;
    const nodeMap = {};

    // Track visited nodes by code + parentId to allow same item in different branches
    function addNode(item, parentId, quantity) {
        const thisId = nodeId++;
        nodeMap[item.code + '_' + parentId] = thisId;
        nodes.push({ id: thisId, code: item.code, name: item.name, quantity });
        if (parentId !== null) {
            links.push({ source: parentId, target: thisId });
        }
        if (item.craft && item.craft.items) {
            for (const comp of item.craft.items) {
                const compItem = codeToItem[comp.code];
                if (compItem) {
                    // Allow multiple same item in different branches
                    addNode(compItem, thisId, comp.quantity);
                }
            }
        }
    }
    addNode(rootItem, null, null); // root has no quantity
    renderTree(nodes, links);
}

function renderTree(nodes, links) {
    // Simple tree layout (vertical)
    // We'll use SVG for vanilla JS rendering
    const width = graphDiv.clientWidth || 600;
    const levelHeight = 100;
    // Assign levels
    const nodeLevels = {};
    function assignLevels(nodeId, level) {
        nodeLevels[nodeId] = level;
        links.forEach(l => {
            if (l.source === nodeId) assignLevels(l.target, level + 1);
        });
    }
    assignLevels(0, 0);
    // Group nodes by level
    const levels = {};
    nodes.forEach(n => {
        const lvl = nodeLevels[n.id] || 0;
        if (!levels[lvl]) levels[lvl] = [];
        levels[lvl].push(n);
    });
    // Assign x/y
    const nodePos = {};
    Object.entries(levels).forEach(([lvl, arr]) => {
        const y = 40 + lvl * levelHeight;
        const step = width / (arr.length + 1);
        arr.forEach((n, i) => {
            nodePos[n.id] = { x: step * (i + 1), y };
        });
    });
    // SVG
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', Math.max(300, Object.keys(levels).length * levelHeight + 60));
    // Draw links
    links.forEach(l => {
        const from = nodePos[l.source];
        const to = nodePos[l.target];
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('stroke', '#888');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
    });
    // Draw nodes
    nodes.forEach(n => {
        const g = document.createElementNS(svgNS, 'g');
        g.setAttribute('class', 'node');
        g.setAttribute('data-code', n.code);
        const { x, y } = nodePos[n.id];
        // Circle
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 28);
        circle.setAttribute('fill', '#fff');
        circle.setAttribute('stroke', '#007bff');
        circle.setAttribute('stroke-width', '3');
        g.appendChild(circle);
        // Image
        const imgUrl = `https://www.artifactsmmo.com/images/items/${n.code}.png`;
        const img = document.createElementNS(svgNS, 'image');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imgUrl);
        img.setAttribute('x', x - 16);
        img.setAttribute('y', y - 24);
        img.setAttribute('width', 32);
        img.setAttribute('height', 32);
        img.setAttribute('onerror', "this.style.display='none'");
        g.appendChild(img);
        // Text (name and quantity)
        const maxLen = 10;
        let displayName = n.name;
        let truncated = false;
        if (n.name.length > maxLen) {
            displayName = n.name.slice(0, maxLen - 1) + '…';
            truncated = true;
        }
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y + 22);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '13px');
        text.textContent = displayName;
        if (truncated) {
            g.addEventListener('mouseenter', function(e) {
                showNodeNameTooltip(n.name, x, y - 30);
            });
            g.addEventListener('mouseleave', function(e) {
                hideNodeNameTooltip();
            });
        }
        g.appendChild(text);
        if (n.quantity !== null && n.quantity !== undefined) {
            const qtyText = document.createElementNS(svgNS, 'text');
            qtyText.setAttribute('x', x);
            qtyText.setAttribute('y', y + 35);
            qtyText.setAttribute('text-anchor', 'middle');
            qtyText.setAttribute('font-size', '12px');
            qtyText.setAttribute('fill', '#555');
            qtyText.textContent = `x${n.quantity}`;
            g.appendChild(qtyText);
        }
        // Hover popover
        g.addEventListener('mouseenter', e => showNodePopover(n.code, x, y, g));
        g.addEventListener('mouseleave', hideNodePopover);
        // Click loads item info
        g.addEventListener('click', e => {
            e.stopPropagation();
            searchInput.value = n.name;
            searchAndDisplayItem(n.name);
        });
        svg.appendChild(g);
    });
    graphDiv.appendChild(svg);
}

let nodeNameTooltipDiv = null;
function showNodeNameTooltip(name, x, y) {
hideNodeNameTooltip();
nodeNameTooltipDiv = document.createElement('div');
nodeNameTooltipDiv.className = 'position-absolute bg-dark text-white px-2 py-1 rounded shadow';
nodeNameTooltipDiv.style.left = (x + graphDiv.offsetLeft - 40) + 'px';
nodeNameTooltipDiv.style.top = (y + graphDiv.offsetTop - 10) + 'px';
nodeNameTooltipDiv.style.zIndex = 3000;
nodeNameTooltipDiv.style.pointerEvents = 'auto';
nodeNameTooltipDiv.style.fontSize = '13px';
nodeNameTooltipDiv.style.cursor = 'pointer';
nodeNameTooltipDiv.textContent = name;
nodeNameTooltipDiv.title = 'Click to view item info';
nodeNameTooltipDiv.addEventListener('click', function(e) {
e.stopPropagation();
searchInput.value = name;
searchAndDisplayItem(name);
hideNodeNameTooltip();
});
nodeNameTooltipDiv.addEventListener('mouseenter', function() {
nodeNameTooltipDiv.classList.add('bg-primary');
});
nodeNameTooltipDiv.addEventListener('mouseleave', function() {
nodeNameTooltipDiv.classList.remove('bg-primary');
});
document.body.appendChild(nodeNameTooltipDiv);
}
function hideNodeNameTooltip() {
if (nodeNameTooltipDiv) {
document.body.removeChild(nodeNameTooltipDiv);
nodeNameTooltipDiv = null;
}
}

let popoverDiv = null;
async function showNodePopover(code, x, y, g) {
if (popoverDiv) hideNodePopover();
// Fetch item info by code
const res = await fetch(`${API_BASE}/${code}`);
const data = await res.json();
const item = data.data;
const imgUrl = `https://www.artifactsmmo.com/images/items/${item.code}.png`;
popoverDiv = document.createElement('div');
popoverDiv.className = 'popover bs-popover-auto show position-absolute';
popoverDiv.style.left = (x + graphDiv.offsetLeft - 60) + 'px';
popoverDiv.style.top = (y + graphDiv.offsetTop - 40) + 'px';
popoverDiv.style.zIndex = 2000;
popoverDiv.innerHTML = `<div class="popover-arrow"></div><div class="d-flex align-items-center mb-2"><img src="${imgUrl}" alt="${item.name}" style="max-width:36px;max-height:36px;margin-right:8px;" onerror="this.style.display='none'"><h3 class="popover-header mb-0">${item.name}</h3></div><div class="popover-body">
<strong>Type:</strong> ${item.type || ''} ${item.subtype || ''}<br>
<strong>Level:</strong> ${item.level || ''}<br>
<strong>Description:</strong> ${item.description || ''}<br>
<strong>Tradeable:</strong> ${item.tradeable ? 'Yes' : 'No'}<br>
${item.effects && item.effects.length ? `<strong>Effects:</strong> ${item.effects.map(e => `${e.code}: ${e.value}`).join(', ')}<br>` : ''}
${item.craft ? `<strong>Craft Skill:</strong> ${item.craft.skill} (Level ${item.craft.level})<br>` : ''}
</div>`;
document.body.appendChild(popoverDiv);
}
function hideNodePopover() {
if (popoverDiv) {
document.body.removeChild(popoverDiv);
popoverDiv = null;
    }
}
