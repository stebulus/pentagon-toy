function mod(a, b) {
    let r = a % b;
    if (r < 0) r += b;
    return r;
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

function Num(a) {
    this.num = a
}

Num.prototype.toNumber = function () {
    return this.num;
};

Num.prototype.equals = function (m) {
    return this.num === m.num;
};

Num.prototype.add = function (m) {
    return new Num(this.num + m.num);
};

Num.prototype.sub = function (m) {
    return new Num(this.num - m.num);
};

Num.prototype.negate = function () {
    return new Num(-this.num);
};

Num.prototype.mul = function (m) {
    if (typeof m == "number") m = new Num(m);
    return new Num(this.num * m.num);
};

function NumRoot3(a, b) {
    this.a = a;
    if (b === undefined) b = 0;
    this.b = b;
}

const ROOT3 = Math.sqrt(3);

NumRoot3.prototype.toNumber = function () {
    return this.a + this.b*ROOT3;
};

NumRoot3.prototype.equals = function (m) {
    return this.a === m.a && this.b === m.b;
};

NumRoot3.prototype.add = function (m) {
    return new NumRoot3(this.a + m.a, this.b + m.b);
};

NumRoot3.prototype.sub = function (m) {
    return new NumRoot3(this.a - m.a, this.b - m.b);
};

NumRoot3.prototype.negate = function () {
    return new NumRoot3(-this.a, -this.b);
};

NumRoot3.prototype.mul = function (m) {
    if (typeof m == "number") m = new NumRoot3(m);
    return new NumRoot3(this.a*m.a + 3*this.b*m.b, this.a*m.b + m.a*this.b);
};

function Vector(dx, dy) {
    this.dx = dx;
    this.dy = dy;
}

Vector.prototype.toString = function () {
    return this.dx.toNumber() + " " + this.dy.toNumber();
};

Vector.prototype.add = function (v) {
    return new Vector(this.dx.add(v.dx), this.dy.add(v.dy));
};

Vector.prototype.equals = function (v) {
    return this.dx.equals(v.dx) && this.dy.equals(v.dy);
};

Vector.prototype.negate = function () {
    return new Vector(this.dx.negate(), this.dy.negate());
};

Vector.prototype.scale = function (r) {
    if (typeof r === "number")
        r = new this.dx.constructor(r)
    return new Vector(this.dx.mul(r), this.dy.mul(r));
};

Vector.prototype.rot90 = function () {
    return new Vector(this.dy.negate(), this.dx);
};

Vector.prototype.swap = function () {
    return new Vector(this.dy, this.dx);
};

Vector.prototype.angle = function () {
    return Math.atan2(this.dy.toNumber(), this.dx.toNumber());
};

Vector.prototype.degrees = function () {
    return this.angle()*180/Math.PI;
};

Vector.prototype.dot = function (v) {
    return this.dx.mul(v.dx).add(this.dy.mul(v.dy));
};

Vector.prototype.normsq = function () {
    return this.dot(this);
};

function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype.toString = function () {
    return this.x.toNumber() + " " + this.y.toNumber();
};

Point.prototype.equals = function (q) {
    return this.x.equals(q.x) && this.y.equals(q.y);
};

Point.prototype.to = function (q) {
    return new Vector(q.x.sub(this.x), q.y.sub(this.y));
};

Point.prototype.fromOrigin = function () {
    return new Vector(this.x, this.y);
};

Point.prototype.translate = function (v) {
    return new Point(this.x.add(v.dx), this.y.add(v.dy));
};

Point.prototype.reflectInOrigin = function () {
    return new Point(this.x.negate(), this.y.negate());
};

Point.polar = function (radius, angle) {
    return new Point(new Num(radius*Math.cos(angle)), new Num(radius*Math.sin(angle)));
};

const SVGNS = "http://www.w3.org/2000/svg";

const dragging = {offset: new Vector(new Num(0), new Num(0)), target: null};
const svg = document.querySelector("svg");
svg.addEventListener("mousemove", move, false);
document.body.addEventListener("mouseup", stopDragging, false);
document.body.addEventListener("mouseleave", stopDragging, false);

function event2svg(event) {
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return new Point(new Num(q.x), new Num(q.y));
}

function move(event) {
    target = dragging.target;
    if (target != null) {
        const p = event2svg(event);
        target.set(p.translate(dragging.offset));
    }
}

function stopDragging(event) {
    dragging.target = null;
}

function startDragging(v) {
    return function (event) {
        const p = v.value;
        const svgpt = event2svg(event);
        dragging.offset = svgpt.to(p);
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
        elem.setAttribute("x", p.x.toNumber());
        elem.setAttribute("y", p.y.toNumber());
    });
}

function centre(pvar, circle) {
    return variable([pvar], function (p) {
        circle.setAttribute("cx", p.x.toNumber());
        circle.setAttribute("cy", p.y.toNumber());
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

function rotate180(pvar, qvar) {
    return variable([pvar, qvar], function (p, q) {
        const m = p.translate(p.to(q).scale(0.5));
        return "rotate(180 " + m + ")";
    });
}

function ray2ray(p1var, q1var, p2var, q2var) {
    return variable([p1var, q1var, p2var, q2var], function (p1, q1, p2, q2) {
        const translate = "translate(" + p1.to(p2) + ")";
        const ang1 = p1.to(q1).degrees();
        const ang2 = p2.to(q2).degrees();
        const rotate = "rotate(" + (ang2 - ang1) + " " + p2 + ")";
        return [rotate, translate].join(" ");
    });
}

function ray2rayflip(p1var, q1var, p2var, q2var) {
    return variable([p1var, q1var, p2var, q2var], function (p1, q1, p2, q2) {
        const ang1 = p1.to(q1).degrees();
        const ang2 = p2.to(q2).degrees();
        const flip =
            "rotate(" + ang1 + " " + p1 + ")"
            + " translate(" + p1 + ")"
            + " scale(1 -1)"
            + " translate(" + p1.reflectInOrigin() + ")"
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

const vertices = document.querySelector("#vertices");
const dots = [];
for (let i = 0; i < 5; i++) {
    const circle = document.createElementNS(SVGNS, "circle");
    circle.setAttribute("r", "3mm");
    vertices.appendChild(circle);
    const dot = new Store(Point.polar(90, (i/5 - 1/4)*2*Math.PI));
    dots.push(dot);
    centre(dot, circle);
    circle.addEventListener("mousedown", startDragging(dot), false);
}
polygon(dots, document.querySelector("#pentagon"));

const labelsVisible = new Store(false);
const labelLocation = centroid(dots);

function pentagons(xfm, specs, hue) {
    const pentagong = document.querySelector("#pentagon-g");
    pentagong.setAttribute("fill", "hsl(" + ((hue+180) % 360) + " 100% 50%)");
    const transformed = document.querySelector("#transformed");
    transformed.setAttribute("fill", "hsl(" + hue + " 100% 50%)");
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
