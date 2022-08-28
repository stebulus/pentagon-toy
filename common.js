function mod(a, b) {
    let r = a % b;
    if (r < 0) r += b;
    return r;
}

function div(a, b) {
    return Math.floor(a/b);
}

function onValues(f) {
    return function (d) {
        const result = {};
        for (const prop in d)
            result[prop] = f(d[prop]);
        return result;
    };
}

function iterate(x, f, n) {
    if (n === 0)
        return [];
    const result = [x];
    for (let i = 1; i < n; i++) {
        x = f(x);
        result.push(x);
    }
    return result;
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

function Vector(dx, dy) {
    this.dx = dx;
    this.dy = dy;
}

function vec(dx, dy) { return new Vector(dx, dy); }

Vector.prototype.toString = function () {
    return this.dx + " " + this.dy;
};

Vector.prototype.add = function (v) {
    return vec(this.dx + v.dx, this.dy + v.dy);
};

Vector.prototype.equals = function (v) {
    return this.dx === v.dx && this.dy === v.dy;
};

Vector.prototype.negate = function () {
    return vec(-this.dx, -this.dy);
};

Vector.prototype.scale = function (r) {
    return vec(r*this.dx, r*this.dy);
};

Vector.prototype.rot90 = function () {
    return vec(-this.dy, this.dx);
};

Vector.prototype.swap = function () {
    return vec(this.dy, this.dx);
};

Vector.prototype.flip = function () {
    return vec(this.dx, -this.dy);
};

Vector.prototype.flop = function () {
    return vec(-this.dx, this.dy);
};

Vector.prototype.angle = function () {
    return Math.atan2(this.dy, this.dx);
};

Vector.prototype.degrees = function () {
    return this.angle()*180/Math.PI;
};

Vector.prototype.dot = function (v) {
    return this.dx*v.dx + this.dy*v.dy;
};

Vector.prototype.normsq = function () {
    return this.dot(this);
};

function Point(x, y) {
    this.x = x;
    this.y = y;
}

function pt(x, y) { return new Point(x, y); }

Point.prototype.toString = function () {
    return this.x + " " + this.y;
};

Point.prototype.equals = function (q) {
    return this.x === q.x && this.y === q.y;
};

Point.prototype.to = function (q) {
    return vec(q.x - this.x, q.y - this.y);
};

Point.prototype.translate = function (v) {
    return pt(this.x + v.dx, this.y + v.dy);
};

Point.polar = function (radius, angle) {
    return pt(radius*Math.cos(angle), radius*Math.sin(angle));
};

midpoint = function (p, q) {
    return p.translate(p.to(q).scale(0.5));
}

const origin = pt(0, 0);
const zero = origin.to(origin);

/*
    A crude reactive framework.  A "Variable" contains a function to
    compute its next value.  The arguments to that function are the
    current values of other Variables; each Variable keeps track of
    the Variables that depend on it, forming a directed acyclic graph.
    Sources in the graph are "Store"s, whose values are set by code
    outside the Variable graph.  Variables are updated all at once
    by an "update event", which is scheduled when a Store is updated.
*/

// all Variables, sorted (dependencies before their dependents)
const variables = [];

function recomputeAll() {
    for (const v of variables) {
        v.dirty = true;
    }
    update();
}

/* usually created by the convenience function variable(),
   which sets the .compute property
*/
class Variable {
    constructor(dependencies) {
        // whether the value should be recomputed
        this.dirty = false;
        // other variables that depend on this one
        this.dependents = [];
        /* since dependencies are passed as arguments, they already
           exist & are in the variables array, so appending this
           variable maintains the sorting */
        variables.push(this);
        // register this as a dependent of its dependencies
        for (const dep of dependencies)
            dep.dependents.push(this);
    }

    update() {
        if (this.dirty) {
            /* we assume that this variable's dependencies are up to date
               (see update()) */
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

// ensure an update event is scheduled
// (usually a side-effect of Store.prototype.set)
update = (function () {
    let update_scheduled = false;
    return function () {
        if (!update_scheduled) {
            setTimeout(function () {
                update_scheduled = false;
                /* since variables are sorted, updating them in order
                   ensures that each sees up-to-date values of its
                   dependencies */
                for (const v of variables)
                    v.update();
            });
            update_scheduled = true;
        }
    };
})();

// a Variable that can be set by code outside the Variable graph
class Store extends Variable {
    constructor(initialValue) {
        super([]);
        this.set(initialValue);
    }
    compute() {
        return this.newValue;
    }
    set(value) {
        /* stash value for next update(); don't change value immediately,
           because if we're being called indirectly from update(),
           that could result in different Variables seeing different
           values of this one during the same update event
        */
        this.newValue = value;
        this.dirty = true;
        /* ok to call update() on every call to set()
           because update() doesn't schedule itself if already scheduled
        */
        update();
    }
    change(f) {
        this.set(f(this.newValue));
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

/*
    Variables for the pentagon application
*/

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
            strings.push(p.toString());
        gon.setAttribute("points", strings.join(" "));
    });
}

function gtransform(tvar, g) {
    return variable([tvar], function (t) {
        g.setAttribute("transform", t);
    });
}

/* The transform that rotates line segment PQ by 180 degrees. */
function rotate180(pvar, qvar) {
    return variable([pvar, qvar], function (p, q) {
        return "rotate(180 " + midpoint(p, q) + ")";
    });
}

/* The transform that moves ray P1Q1 to ray P2Q2. */
function ray2ray(p1var, q1var, p2var, q2var) {
    return variable([p1var, q1var, p2var, q2var], function (p1, q1, p2, q2) {
        const translate = "translate(" + p1.to(p2) + ")";
        const ang1 = p1.to(q1).degrees();
        const ang2 = p2.to(q2).degrees();
        const rotate = "rotate(" + (ang2 - ang1) + " " + p2 + ")";
        return [rotate, translate].join(" ");
    });
}

/* The transform that moves ray P1Q1 to ray P2Q2 and reflects across it. */
function ray2rayflip(p1var, q1var, p2var, q2var) {
    return variable([p1var, q1var, p2var, q2var], function (p1, q1, p2, q2) {
        const ang1 = p1.to(q1).degrees();
        const ang2 = p2.to(q2).degrees();
        const flip =
            "rotate(" + ang1 + " " + p1 + ")"
            + " translate(" + origin.to(p1) + ")"
            + " scale(1 -1)"
            + " translate(" + p1.to(origin) + ")"
            + " rotate(" + (-ang1) + " " + p1 + ")";
        const translate = "translate(" + p1.to(p2) + ")";
        const rotate = "rotate(" + (ang2 - ang1) + " " + p2 + ")";
        return rotate + translate + flip;
    });
}

function centroid(pointvars) {
    return variable(pointvars, function () {
        const origin = arguments[0];
        let v = origin.to(origin);
        for (const p of arguments)
            v = v.add(origin.to(p));
        v = v.scale(1/arguments.length);
        return origin.translate(v);
    });
}

/*
    Manipulation of edge classes
*/

function swapped(edgeClass) {
    return onValues(function (v) { return v.swap(); })(edgeClass);
}

function negated(edgeClass) {
    return onValues(function (v) { return v.negate(); })(edgeClass);
}

function flipped(edgeClass) {
    return onValues(function (v) { return v.flip(); })(edgeClass);
}

function flopped(edgeClass) {
    return onValues(function (v) { return v.flop(); })(edgeClass);
}

/*
    Save the positions of vertices in local storage, if available.
*/

try {
    storage = window.localStorage;
} catch (error) {
    console.log("no local storage, alas", error);
    storage = null;
}

function storageKey(i) {
    return document.location.pathname + "#point" + i;
}

function originalDotPosition(i) {
    return Point.polar(90, (i/5 - 1/4)*2*Math.PI);
}

function initialDotPosition(i) {
    try {
        const p = JSON.parse(storage.getItem(storageKey(i)));
        return pt(p.x, p.y);
    } catch (e) {
        return originalDotPosition(i);
    }
}

function storeCoords(ptvar, i) {
    if (storage === null)
        return null;
    else
        return variable([ptvar], function (pt) {
            storage.setItem(storageKey(i), JSON.stringify(pt));
        });
}

/*
    Dragging, as input to the Variable graph
*/

const dragging = {
    targetVar: null,  // Variable for moving point (null if not dragging)
    targetElem: null,  // Element being moved (null if not dragging)
    offset: zero,  // vector from mouse/touch location to target
};

const svg = document.querySelector("svg");
svg.addEventListener("mousemove", drag, false);
svg.addEventListener("touchmove", drag, false);
document.body.addEventListener("mouseup", stopDragging, false);
document.body.addEventListener("mouseleave", stopDragging, false);
document.body.addEventListener("touchcancel", stopDragging, false);
document.body.addEventListener("touchend", stopDragging, false);

/*
    Make element draggable, setting ptvar (a Store) to its location
    (a Point in SVG coordinates).  setAttributes is a function such
    as centre() or xy().
*/
function makeDraggable(element, ptvar, setAttributes) {
    element.classList.add("draggable");
    element.addEventListener("mousedown", startDragging(ptvar), false);
    element.addEventListener("touchstart", startDragging(ptvar), false);
    setAttributes(ptvar, element);
}

// The location of the given mouse or touch event, as a Point
function eventPoint(event) {
    const p = svg.createSVGPoint();
    const locatedEvent = event.targetTouches === undefined
        ? event : event.targetTouches[0];
    p.x = locatedEvent.clientX;
    p.y = locatedEvent.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return pt(q.x, q.y);
}

function drag(event) {
    targetVar = dragging.targetVar;
    if (targetVar != null) {
        targetVar.set(eventPoint(event).translate(dragging.offset));
        event.preventDefault();
    }
}

function stopDragging() {
    targetElem = dragging.targetElem;
    if (targetElem !== null)
        targetElem.classList.remove("dragging");
    dragging.targetVar = null;
    dragging.targetElem = null;
}

function startDragging(ptvar) {
    return function (event) {
        dragging.offset = eventPoint(event).to(ptvar.value);
        dragging.targetVar = ptvar;
        dragging.targetElem = event.target;
        dragging.targetElem.classList.add("dragging");
    }
}

const SVGNS = "http://www.w3.org/2000/svg";
const dotRadius = window.matchMedia("(pointer: coarse)").matches ? "8mm" : "4mm";

const vertices = document.querySelector("#vertices");
const dots = [];
for (let i = 0; i < 5; i++) {
    const circle = document.createElementNS(SVGNS, "circle");
    circle.setAttribute("r", dotRadius);
    vertices.appendChild(circle);
    const dot = new Store(initialDotPosition(i));
    dots.push(dot);
    makeDraggable(circle, dot, centre);
    storeCoords(dot, i);
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
    const arr = Array.from(path);
    for (let i = 0; i < path.length-1; i++)
        if (arr[i] == arr[i+1])
            quality--;
    arr.sort();
    for (let i = 0; i < arr.length-1; i++)
        if (arr[i] != arr[i+1])
            quality++;
    return quality;
}

function paths(start, edgesFrom) {
    const seen = [];
    function haveSeen(node) {
        for (const seenNode of seen) {
            if (seenNode.equals(node))
                return true;
        }
        return false;
    }
    const queue = [{"": start}];
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

function neighbours(allEdgeVecs, accept) {
    return function (p) {
        const vecs = allEdgeVecs(p);
        const result = {};
        for (const name in vecs) {
            const neighbour = p.translate(vecs[name]);
            if (accept(neighbour))
                result[name] = neighbour;
        }
        return result;
    };
}

function setUpButton(selector, handle) {
    const button = document.querySelector(selector);
    button.addEventListener("click", handle);
    button.removeAttribute("disabled");
}

function setUpButtons() {
    const magFactor = Math.sqrt(2);
    const magnification = new Store(1);
    gtransform(
        variable([magnification], function (mag) {
            return "scale(" + mag + ")";
        }),
        document.querySelector("#magnification")
    );
    setUpButton("#shrink", function () {
        magnification.change(function (x) { return x/magFactor; });
    });
    setUpButton("#enlarge", function () {
        magnification.change(function (x) { return x*magFactor; });
    });
    setUpButton("#start-over", function () {
        for (let i = 0; i < 5; i++)
            dots[i].set(originalDotPosition(i));
        magnification.set(1);
    });
}
