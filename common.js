function mod(a, b) {
    let r = a % b;
    if (r < 0) r += b;
    return r;
}

function best(arr, score) {
    let bestItem = arr[0];
    let bestScore = score(bestItem);
    for (let i = 1; i < arr.length; i++) {
        const newScore = score(arr[i]);
        if (newScore > bestScore) {
            bestItem = arr[i];
            bestScore = newScore;
        }
    }
    return bestItem;
}

const SVGNS = "http://www.w3.org/2000/svg";

const dragging = {dx: 0, dy: 0, target: null};
const svg = document.querySelector("svg");
svg.addEventListener("mousemove", move, false);
document.body.addEventListener("mouseup", stopDragging, false);
document.body.addEventListener("mouseleave", stopDragging, false);

function event2svg(event) {
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return {x: q.x, y: q.y};
}

function move(event) {
    target = dragging.target;
    if (target != null) {
        const p = event2svg(event);
        target.set({
            x: p.x + dragging.dx,
            y: p.y + dragging.dy
        });
    }
}

function stopDragging(event) {
    dragging.target = null;
}

function startDragging(v) {
    return function (event) {
        const p = v.value;
        const svgpt = event2svg(event);
        dragging.dx = p.x - svgpt.x;
        dragging.dy = p.y - svgpt.y;
        dragging.target = v;
    }
}

const variables = [];

class Variable {
    constructor(dependencies) {
        this.dirty = false;
        this.dependents = [];
        variables.push(this);
        for (const dep of dependencies)
            dep.dependents.push(this);
    }

    update() {
        if (this.dirty) {
            const newValue = this.compute();
            if (newValue != this.value) {
                this.value = newValue;
                for (const dep of this.dependents)
                    dep.dirty = true;
            }
            this.dirty = false;
        }
    }
}

update = (function () {
    let update_scheduled = false;
    return function () {
        if (!update_scheduled) {
            setTimeout(function () {
                update_scheduled = false;
                for (const v of variables)
                    v.update();
            });
            update_scheduled = true;
        }
    };
})();

class Store extends Variable {
    constructor(initialValue) {
        super([]);
        this.set(initialValue);
    }
    compute() {
        return this.newValue;
    }
    set(value) {
        this.newValue = value;
        this.dirty = true;
        update();
    }
}

function variable(dependencies, compute) {
    const v = new Variable(dependencies);
    v.compute = function () {
        return compute.apply(null,
            dependencies.map(function (x) { return x.value; }));
    };
    return v;
}

function visibility(boolvar, elem) {
    return variable([boolvar], function (vis) {
        elem.setAttribute("visibility", vis ? "visible" : "hidden");
    });
}

function xy(pvar, elem) {
    return variable([pvar], function (p) {
        elem.setAttribute("x", p.x);
        elem.setAttribute("y", p.y);
    });
}

function centre(pvar, circle) {
    return variable([pvar], function (p) {
        circle.setAttribute("cx", p.x);
        circle.setAttribute("cy", p.y);
    });
}

function polygon(vertexvars, gon) {
    return variable(vertexvars, function () {
        const strings = [];
        for (const p of arguments)
            strings.push(p.x + "," + p.y);
        gon.setAttribute("points", strings.join(" "));
    });
}

function gtransform(tvar, g) {
    return variable([tvar], function (t) {
        g.setAttribute("transform", t);
    });
}

function rotate180(pvar, qvar) {
    return variable([pvar, qvar], function (p, q) {
        const m = {x: (p.x + q.x)/2, y: (p.y + q.y)/2};
        return "rotate(180 " + m.x + " " + m.y + ")";
    });
}

function ray2ray(p1var, q1var, p2var, q2var) {
    return variable([p1var, q1var, p2var, q2var], function (p1, q1, p2, q2) {
        const tr = {x: p2.x - p1.x, y: p2.y - p1.y};
        const translate = "translate(" + tr.x + " " + tr.y + ")";
        const ang1 = Math.atan2(q1.y - p1.y, q1.x - p1.x);
        const ang2 = Math.atan2(q2.y - p2.y, q2.x - p2.x);
        const rot = (ang2 - ang1)*180/Math.PI
        const rotate = "rotate(" + rot + " " + p2.x + " " + p2.y + ")";
        return [rotate, translate].join(" ");
    });
}

function ray2rayflip(p1var, q1var, p2var, q2var) {
    return variable([p1var, q1var, p2var, q2var], function (p1, q1, p2, q2) {
        const ang1 = Math.atan2(q1.y - p1.y, q1.x - p1.x)*180/Math.PI;
        const ang2 = Math.atan2(q2.y - p2.y, q2.x - p2.x)*180/Math.PI;
        const flip =
            "rotate(" + ang1 + " " + p1.x + " " + p1.y + ")"
            + " translate(" + p1.x + " " + p1.y + ")"
            + " scale(1 -1)"
            + " translate(" + (-p1.x) + " " + (-p1.y) + ")"
            + " rotate(" + (-ang1) + " " + p1.x + " " + p1.y + ")";
        const tr = {x: p2.x - p1.x, y: p2.y - p1.y};
        const translate = "translate(" + tr.x + " " + tr.y + ")";
        const rotate = "rotate(" + (ang2 - ang1) + " " + p2.x + " " + p2.y + ")";
        return rotate + translate + flip;
    });
}

function centroid(pointvars) {
    return variable(pointvars, function () {
        let n = 0, x = 0, y = 0;
        for (const p of arguments) {
            n++;
            x += p.x;
            y += p.y;
        }
        return {x: x/n, y: y/n};
    });
}

const vertices = document.querySelector("#vertices");
const dots = [];
for (let i = 0; i < 5; i++) {
    const circle = document.createElementNS(SVGNS, "circle");
    circle.setAttribute("r", "3mm");
    vertices.appendChild(circle);
    const angle = (i/5 - 1/4)*2*Math.PI;
    const radius = 90;
    const dot = new Store({x: radius*Math.cos(angle), y: radius*Math.sin(angle)});
    dots.push(dot);
    centre(dot, circle);
    circle.addEventListener("mousedown", startDragging(dot), false);
}
polygon(dots, document.querySelector("#pentagon"));

const labelsVisible = new Store(false);
const labelLocation = centroid(dots);

function pentagons(xfm, specs) {
    const transformed = document.querySelector("#transformed");
    for (const spec of specs) {
        let base = transformed;
        for (const c of spec) {
            const g = document.createElementNS(SVGNS, "g");
            gtransform(xfm[c], g);
            base.appendChild(g);
            base = g;
        }
        const use = document.createElementNS(SVGNS, "use");
        use.setAttribute("href", "#pentagon");
        base.appendChild(use);
        const text = document.createElementNS(SVGNS, "text");
        text.appendChild(document.createTextNode(spec));
        text.setAttribute("fill", "black");
        text.setAttribute("fill-opacity", "1");
        text.setAttribute("text-anchor", "middle");
        base.appendChild(text);
        xy(labelLocation, text);
        visibility(labelsVisible, text);
    }
}

function pathQuality(path) {
    let quality = 0;
    for (let i = 0; i < path.length-1; i++)
        if (path.charAt(i) == path.charAt(i+1))
            quality--;
    const arr = Array.from(path);
    arr.sort();
    for (let i = 0; i < arr.length-1; i++)
        if (arr[i] != arr[i+1])
            quality++;
    return quality;
}

function paths(edgesFrom) {
    const seen = [];
    function haveSeen(node) {
        for (const seenNode of seen) {
            if (seenNode.x === node.x && seenNode.y === node.y)
                return true;
        }
        return false;
    }
    const queue = [{"": { x: 0, y: 0 }}];
    const paths = [];
    while (queue.length > 0) {
        const fan = queue.shift();
        const fanPaths = Object.keys(fan);
        if (fanPaths.length == 0)
            continue;
        const candidatePath = best(fanPaths, pathQuality);
        const candidateNode = fan[candidatePath];
        if (fanPaths.length > 1) {
            delete fan[candidatePath];
            queue.push(fan);
        }
        if (haveSeen(candidateNode))
            continue;
        paths.push(candidatePath);
        seen.push(candidateNode);
        const children = edgesFrom(candidateNode);
        const newNodes = {};
        for (const xfm in children)
            newNodes[candidatePath + xfm] = children[xfm];
        queue.push(newNodes);
    }
    paths.shift();
    return paths;
}
