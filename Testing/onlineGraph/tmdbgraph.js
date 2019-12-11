(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
    "use strict";
    const $ = require("jquery");
    var tmdb;
    (function (tmdb) {
        class NodeType {
            constructor(type, credits, label, imagesarray) {
                this.type = type;
                this.credits = credits;
                this.label = label;
                this.imagesarray = imagesarray;
            }
            toString() {
                return this.type;
            }
            next() {
                return this === tmdb.Movie ? tmdb.Person : tmdb.Movie;
            }
            makeEdge(thisName, otherName) {
                return this === tmdb.Movie ? new Edge(thisName, otherName) : new Edge(otherName, thisName);
            }
        }
        tmdb.Movie = new NodeType("movie", "credits", "title", "posters");
        tmdb.Person = new NodeType("person", "movie_credits", "name", "profiles");
        class Node {
            constructor(type, id) {
                this.type = type;
                this.id = id;
                this.degree = 0;
            }
            name() { return this.type + this.id.toString(); }
            getImage() {
                var d = $.Deferred();
                var images = request(this.type, this.id, "images");
                $.when(images).then(i => {
                    var paths = i[this.type.imagesarray];
                    this.imgurl = paths.length > 0
                        ? 'http://image.tmdb.org/t/p/w185/' + paths[0].file_path
                        : 'http://upload.wikimedia.org/wikipedia/commons/3/37/No_person.jpg';
                    d.resolve(this);
                });
                return d.promise();
            }
        }
        tmdb.Node = Node;
        class Edge {
            constructor(source, target) {
                this.source = source;
                this.target = target;
            }
            toString() {
                return this.source + '-' + this.target;
            }
        }
        tmdb.Edge = Edge;
        const delay = 10000 / 40; // limit to 40 requests in 10 second span
        let last = 0;
        function request(type, id, content = null, append = null) {
            var query = "https://api.themoviedb.org/3/" + type + "/" + id;
            if (content) {
                query += "/" + content;
            }
            query += "?api_key=1bba0362f468d50d2ec27acff6d5e05a";
            if (append) {
                query += "&append_to_response=" + append;
            }
            var dfd = $.Deferred();
            function defer() {
                if (last < 1) {
                    last++;
                    setTimeout(() => last--, delay);
                    dfd.resolve($.get(query));
                }
                else
                    setTimeout(defer, delay);
                return dfd;
            }
            return defer();
            //return $.get(query);
        }
        class Graph {
            constructor() {
                this.nodes = {};
                this.edges = {};
            }
            expandNeighbours(node, f) {
                var dn = node.cast.map(c => this.getNode(node.type.next(), c.id, v => {
                    v.label = c[v.type.label];
                    this.addEdge(node, v);
                    f(v);
                }));
                var d = $.Deferred();
                $.when.apply($, dn)
                    .then(function () {
                    var neighbours = Array.prototype.slice.call(arguments);
                    d.resolve(neighbours);
                });
                return d.promise();
            }
            fullyExpanded(node) {
                return node.cast && node.cast.every(v => (node.type.next() + v.id) in this.nodes);
            }
            addNode(type, id) {
                var node = new Node(type, id);
                return this.nodes[node.name()] = node;
            }
            getNode(type, id, f) {
                var d = $.Deferred();
                var name = type + id.toString();
                if (name in this.nodes) {
                    return this.nodes[name];
                }
                var node = this.addNode(type, id);
                f(node);
                var cast = request(type, id, null, type.credits);
                $.when(cast).then(c => {
                    node.label = c[type.label];
                    (node.cast = c[type.credits].cast).forEach((v) => {
                        var neighbourname = type.next() + v.id.toString();
                        if (neighbourname in this.nodes) {
                            this.addEdge(node, this.nodes[neighbourname]);
                        }
                    });
                    d.resolve(node);
                });
                return d.promise();
            }
            addEdge(u, v) {
                var edge = u.type.makeEdge(u.name(), v.name());
                var ename = edge.toString();
                if (!(ename in this.edges)) {
                    this.edges[ename] = edge;
                }
                ++u.degree, ++v.degree;
            }
        }
        tmdb.Graph = Graph;
    })(tmdb || (tmdb = {}));
    const cola = require("../index");
    var width = 960, height = 500, imageScale = 0.1;
    var red = "rgb(254, 137, 137)";
    var d3cola = cola.d3adaptor(d3)
        .linkDistance(60)
        .size([width, height]);
    var outer = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("pointer-events", "all");
    var zoom = d3.behavior.zoom();
    outer.append('rect')
        .attr('class', 'background')
        .attr('width', "100%")
        .attr('height', "100%")
        .call(zoom.on("zoom", redraw))
        .on("dblclick.zoom", zoomToFit);
    var defs = outer.append("svg:defs");
    function addGradient(id, colour1, opacity1, colour2, opacity2) {
        var gradient = defs.append("svg:linearGradient")
            .attr("id", id)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%")
            .attr("spreadMethod", "pad");
        gradient.append("svg:stop")
            .attr("offset", "0%")
            .attr("stop-color", colour1)
            .attr("stop-opacity", opacity1);
        gradient.append("svg:stop")
            .attr("offset", "100%")
            .attr("stop-color", colour2)
            .attr("stop-opacity", opacity2);
    }
    addGradient("SpikeGradient", "red", 1, "red", 0);
    addGradient("EdgeGradient", red, 1, "darkgray", 1);
    addGradient("ReverseEdgeGradient", "darkgray", 1, red, 1);
    var vis = outer.append('g');
    var edgesLayer = vis.append("g");
    var nodesLayer = vis.append("g");
    var nodeMouseDown = false;
    function redraw(transition) {
        // if mouse down then we are dragging not panning
        if (nodeMouseDown)
            return;
        (transition ? vis.transition() : vis)
            .attr("transform", "translate(" + zoom.translate() + ") scale(" + zoom.scale() + ")");
    }
    var modelgraph = new tmdb.Graph();
    var viewgraph = { nodes: [], links: [] };
    var nodeWidth = 30, nodeHeight = 35;
    function refocus(focus) {
        var neighboursExpanded = modelgraph.expandNeighbours(focus, function (v) {
            if (!inView(v))
                addViewNode(v, focus);
        });
        refreshViewGraph();
        $.when(neighboursExpanded).then(function f() {
            refreshViewGraph();
        });
    }
    function refreshViewGraph() {
        viewgraph.links = [];
        viewgraph.nodes.forEach(function (v) {
            var fullyExpanded = modelgraph.fullyExpanded(v);
            v.colour = fullyExpanded ? "darkgrey" : red;
            if (!v.cast)
                return;
        });
        Object.keys(modelgraph.edges).forEach(function (e) {
            var l = modelgraph.edges[e];
            var u = modelgraph.nodes[l.source], v = modelgraph.nodes[l.target];
            if (inView(u) && inView(v))
                viewgraph.links.push({ source: u, target: v });
            if (inView(u) && !inView(v))
                u.colour = red;
            if (!inView(u) && inView(v))
                v.colour = red;
        });
        update();
    }
    function hintNeighbours(v) {
        if (!v.cast)
            return;
        var hiddenEdges = v.cast.length + 1 - v.degree;
        var r = 2 * Math.PI / hiddenEdges;
        for (var i = 0; i < hiddenEdges; ++i) {
            var w = nodeWidth - 6, h = nodeHeight - 6, x = w / 2 + 25 * Math.cos(r * i), y = h / 2 + 30 * Math.sin(r * i), rect = new cola.Rectangle(0, w, 0, h), vi = rect.rayIntersection(x, y);
            var dview = d3.select("#" + v.name() + "_spikes");
            dview.append("rect")
                .attr("class", "spike")
                .attr("rx", 1).attr("ry", 1)
                .attr("x", 0).attr("y", 0)
                .attr("width", 10).attr("height", 2)
                .attr("transform", "translate(" + vi.x + "," + vi.y + ") rotate(" + (360 * i / hiddenEdges) + ")")
                .on("click", function () { click(v); });
        }
    }
    function unhintNeighbours(v) {
        var dview = d3.select("#" + v.name() + "_spikes");
        dview.selectAll(".spike").remove();
    }
    function inView(v) { return typeof v.viewgraphid !== 'undefined'; }
    function addViewNode(v, startpos) {
        v.viewgraphid = viewgraph.nodes.length;
        var d = v.getImage();
        $.when(d).then(function (node) {
            d3.select("#" + node.name()).append("image")
                .attr("width", 0)
                .attr("height", 0)
                .attr("transform", "translate(2,2)")
                .attr("xlink:href", function (v) {
                var url = v.imgurl;
                var simg = this;
                var img = new Image();
                img.onload = function () {
                    simg.setAttribute("width", nodeWidth - 4);
                    simg.setAttribute("height", nodeHeight - 4);
                };
                return img.src = url;
            }).on("click", function () { click(node); });
        });
        if (typeof startpos !== 'undefined') {
            v.x = startpos.x;
            v.y = startpos.y;
        }
        viewgraph.nodes.push(v);
    }
    function click(node) {
        if (node.colour !== red)
            return;
        var focus = modelgraph.getNode(node.type, node.id, addViewNode);
        refocus(focus);
    }
    function update() {
        d3cola.nodes(viewgraph.nodes)
            .links(viewgraph.links)
            .start();
        var link = edgesLayer.selectAll(".link")
            .data(viewgraph.links);
        link.enter().append("rect")
            .attr("x", 0).attr("y", 0)
            .attr("height", 2)
            .attr("class", "link");
        link.exit().remove();
        link
            .attr("fill", function (d) {
            if (d.source.colour === red && d.target.colour === red)
                return red;
            if (d.source.colour !== red && d.target.colour !== red)
                return "darkgray";
            return d.source.colour === red ? "url(#ReverseEdgeGradient)" : "url(#EdgeGradient)";
        });
        var node = nodesLayer.selectAll(".node")
            .data(viewgraph.nodes, function (d) { return d.viewgraphid; });
        var nodeEnter = node.enter().append("g")
            .attr("id", function (d) { return d.name(); })
            .attr("class", "node")
            .on("mousedown", function () { nodeMouseDown = true; }) // recording the mousedown state allows us to differentiate dragging from panning
            .on("mouseup", function () { nodeMouseDown = false; })
            .on("touchmove", function () { d3.event.preventDefault(); })
            .on("mouseenter", function (d) { hintNeighbours(d); }) // on mouse over nodes we show "spikes" indicating there are hidden neighbours
            .on("mouseleave", function (d) { unhintNeighbours(d); })
            .call(d3cola.drag);
        nodeEnter.append("g").attr("id", function (d) { return d.name() + "_spikes"; })
            .attr("transform", "translate(3,3)");
        nodeEnter.append("rect")
            .attr("rx", 5).attr("ry", 5)
            .style("stroke-width", "0")
            .attr("width", nodeWidth).attr("height", nodeHeight)
            .on("click", function (d) { click(d); })
            .on("touchend", function (d) { click(d); });
        nodeEnter.append("title")
            .text(function (d) { return d.label; });
        node.style("fill", function (d) { return d.colour; });
        d3cola.on("tick", function () {
            link.attr("transform", function (d) {
                var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
                var r = 180 * Math.atan2(dy, dx) / Math.PI;
                return "translate(" + d.target.x + "," + d.target.y + ") rotate(" + r + ") ";
            }).attr("width", function (d) {
                var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
                return Math.sqrt(dx * dx + dy * dy);
            });
            node.attr("transform", function (d) { return "translate(" + (d.x - nodeWidth / 2) + "," + (d.y - nodeHeight / 2) + ")"; });
        });
    }
    function graphBounds() {
        var x = Number.POSITIVE_INFINITY, X = Number.NEGATIVE_INFINITY, y = Number.POSITIVE_INFINITY, Y = Number.NEGATIVE_INFINITY;
        nodesLayer.selectAll(".node").each(function (v) {
            x = Math.min(x, v.x - nodeWidth / 2);
            X = Math.max(X, v.x + nodeWidth / 2);
            y = Math.min(y, v.y - nodeHeight / 2);
            Y = Math.max(Y, v.y + nodeHeight / 2);
        });
        return { x: x, X: X, y: y, Y: Y };
    }
    function fullScreenCancel() {
        outer.attr("width", width).attr("height", height);
        zoomToFit();
    }
    function zoomToFit() {
        var b = graphBounds();
        var w = b.X - b.x, h = b.Y - b.y;
        var cw = Number(outer.attr("width")), ch = Number(outer.attr("height"));
        var s = Math.min(cw / w, ch / h);
        var tx = (-b.x * s + (cw / s - w) * s / 2), ty = (-b.y * s + (ch / s - h) * s / 2);
        zoom.translate([tx, ty]).scale(s);
        redraw(true);
    }
    const fullscreen = require("fullscreen");
    $().ready(() => {
        $("#zoomToFitButton").click(zoomToFit);
        $("#fullScreenButton").click(() => {
            let fs = fullscreen(outer[0][0]);
            fs.request();
            outer.attr('width', screen.width).attr('height', screen.height);
            zoomToFit();
            fs.on('release', fullScreenCancel);
        });
        // get first node
        var d = modelgraph.getNode(tmdb.Movie, 550, addViewNode);
        $.when(d).then(function (startNode) {
            refocus(startNode);
        });
    });
    },{"../index":2,"fullscreen":23,"jquery":24}],2:[function(require,module,exports){
    "use strict";
    function __export(m) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    }
    __export(require("./src/adaptor"));
    __export(require("./src/d3adaptor"));
    __export(require("./src/descent"));
    __export(require("./src/geom"));
    __export(require("./src/gridrouter"));
    __export(require("./src/handledisconnected"));
    __export(require("./src/layout"));
    __export(require("./src/layout3d"));
    __export(require("./src/linklengths"));
    __export(require("./src/powergraph"));
    __export(require("./src/pqueue"));
    __export(require("./src/rbtree"));
    __export(require("./src/rectangle"));
    __export(require("./src/shortestpaths"));
    __export(require("./src/vpsc"));
    __export(require("./src/batch"));
    },{"./src/adaptor":3,"./src/batch":4,"./src/d3adaptor":5,"./src/descent":8,"./src/geom":9,"./src/gridrouter":10,"./src/handledisconnected":11,"./src/layout":12,"./src/layout3d":13,"./src/linklengths":14,"./src/powergraph":15,"./src/pqueue":16,"./src/rbtree":17,"./src/rectangle":18,"./src/shortestpaths":19,"./src/vpsc":20}],3:[function(require,module,exports){
    "use strict";
    const layout_1 = require("./layout");
    class LayoutAdaptor extends layout_1.Layout {
        // dummy functions in case not defined by client
        trigger(e) { }
        ;
        kick() { }
        ;
        drag() { }
        ;
        on(eventType, listener) { return this; }
        ;
        constructor(options) {
            super();
            // take in implementation as defined by client
            var self = this;
            var o = options;
            if (o.trigger) {
                this.trigger = o.trigger;
            }
            if (o.kick) {
                this.kick = o.kick;
            }
            if (o.drag) {
                this.drag = o.drag;
            }
            if (o.on) {
                this.on = o.on;
            }
            this.dragstart = this.dragStart = layout_1.Layout.dragStart;
            this.dragend = this.dragEnd = layout_1.Layout.dragEnd;
        }
    }
    exports.LayoutAdaptor = LayoutAdaptor;
    /**
     * provides an interface for use with any external graph system (e.g. Cytoscape.js):
     */
    function adaptor(options) {
        return new LayoutAdaptor(options);
    }
    exports.adaptor = adaptor;
    },{"./layout":12}],4:[function(require,module,exports){
    "use strict";
    const layout_1 = require("./layout");
    const gridrouter_1 = require("./gridrouter");
    /**
     * @property nudgeGap spacing between parallel edge segments
     * @property margin space around nodes
     * @property groupMargin space around groups
     */
    function gridify(pgLayout, nudgeGap, margin, groupMargin) {
        pgLayout.cola.start(0, 0, 0, 10, false);
        let gridrouter = route(pgLayout.cola.nodes(), pgLayout.cola.groups(), margin, groupMargin);
        return gridrouter.routeEdges(pgLayout.powerGraph.powerEdges, nudgeGap, e => e.source.routerNode.id, e => e.target.routerNode.id);
    }
    exports.gridify = gridify;
    function route(nodes, groups, margin, groupMargin) {
        nodes.forEach(d => {
            d.routerNode = {
                name: d.name,
                bounds: d.bounds.inflate(-margin)
            };
        });
        groups.forEach(d => {
            d.routerNode = {
                bounds: d.bounds.inflate(-groupMargin),
                children: (typeof d.groups !== 'undefined' ? d.groups.map(c => nodes.length + c.id) : [])
                    .concat(typeof d.leaves !== 'undefined' ? d.leaves.map(c => c.index) : [])
            };
        });
        let gridRouterNodes = nodes.concat(groups).map((d, i) => {
            d.routerNode.id = i;
            return d.routerNode;
        });
        return new gridrouter_1.GridRouter(gridRouterNodes, {
            getChildren: (v) => v.children,
            getBounds: v => v.bounds
        }, margin - groupMargin);
    }
    function powerGraphGridLayout(graph, size, grouppadding) {
        // compute power graph
        var powerGraph;
        graph.nodes.forEach((v, i) => v.index = i);
        new layout_1.Layout()
            .avoidOverlaps(false)
            .nodes(graph.nodes)
            .links(graph.links)
            .powerGraphGroups(function (d) {
            powerGraph = d;
            powerGraph.groups.forEach(v => v.padding = grouppadding);
        });
        // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
        // power edges attached to groups are replaced with edges connected to the corresponding group dummy node
        var n = graph.nodes.length;
        var edges = [];
        var vs = graph.nodes.slice(0);
        vs.forEach((v, i) => v.index = i);
        powerGraph.groups.forEach(g => {
            var sourceInd = g.index = g.id + n;
            vs.push(g);
            if (typeof g.leaves !== 'undefined')
                g.leaves.forEach(v => edges.push({ source: sourceInd, target: v.index }));
            if (typeof g.groups !== 'undefined')
                g.groups.forEach(gg => edges.push({ source: sourceInd, target: gg.id + n }));
        });
        powerGraph.powerEdges.forEach(e => {
            edges.push({ source: e.source.index, target: e.target.index });
        });
        // layout the flat graph with dummy nodes and edges
        new layout_1.Layout()
            .size(size)
            .nodes(vs)
            .links(edges)
            .avoidOverlaps(false)
            .linkDistance(30)
            .symmetricDiffLinkLengths(5)
            .convergenceThreshold(1e-4)
            .start(100, 0, 0, 0, false);
        // final layout taking node positions from above as starting positions
        // subject to group containment constraints
        // and then gridifying the layout
        return {
            cola: new layout_1.Layout()
                .convergenceThreshold(1e-3)
                .size(size)
                .avoidOverlaps(true)
                .nodes(graph.nodes)
                .links(graph.links)
                .groupCompactness(1e-4)
                .linkDistance(30)
                .symmetricDiffLinkLengths(5)
                .powerGraphGroups(function (d) {
                powerGraph = d;
                powerGraph.groups.forEach(function (v) {
                    v.padding = grouppadding;
                });
            }).start(50, 0, 100, 0, false),
            powerGraph: powerGraph
        };
    }
    exports.powerGraphGridLayout = powerGraphGridLayout;
    },{"./gridrouter":10,"./layout":12}],5:[function(require,module,exports){
    "use strict";
    const d3v3 = require("./d3v3adaptor");
    const d3v4 = require("./d3v4adaptor");
    ;
    /**
     * provides an interface for use with d3:
     * Correct way to create way to construct the d3 cola object is to pass the d3 object into the adaptor function, like so:
     *
     *   `var d3cola = cola.d3adaptor(d3);`
     *
     * Internally, it will figure out if d3 is version 3 or 4 from the version tag and set up the right event forwarding. Defaults to version 3 if the d3 object is not passed.
     * - uses the d3 event system to dispatch layout events such as:
     *   o "start" (start layout process)
     *   o "tick" (after each layout iteration)
     *   o "end" (layout converged and complete).
     * - uses the d3 timer to queue layout iterations.
     * - sets up d3.behavior.drag to drag nodes
     *   o use `node.call(<the returned instance of Layout>.drag)` to make nodes draggable
     * returns an instance of the cola.Layout itself with which the user
     * can interact directly.
     */
    function d3adaptor(d3Context) {
        if (!d3Context || isD3V3(d3Context)) {
            return new d3v3.D3StyleLayoutAdaptor();
        }
        return new d3v4.D3StyleLayoutAdaptor(d3Context);
    }
    exports.d3adaptor = d3adaptor;
    function isD3V3(d3Context) {
        const v3exp = /^3\./;
        return d3Context.version && d3Context.version.match(v3exp) !== null;
    }
    },{"./d3v3adaptor":6,"./d3v4adaptor":7}],6:[function(require,module,exports){
    "use strict";
    ///<reference path="../extern/d3v3.d.ts"/>
    ///<reference path="layout.ts"/>
    const layout_1 = require("./layout");
    class D3StyleLayoutAdaptor extends layout_1.Layout {
        constructor() {
            super();
            this.event = d3.dispatch(layout_1.EventType[layout_1.EventType.start], layout_1.EventType[layout_1.EventType.tick], layout_1.EventType[layout_1.EventType.end]);
            // bit of trickyness remapping 'this' so we can reference it in the function body.
            var d3layout = this;
            var drag;
            this.drag = function () {
                if (!drag) {
                    var drag = d3.behavior.drag()
                        .origin(layout_1.Layout.dragOrigin)
                        .on("dragstart.d3adaptor", layout_1.Layout.dragStart)
                        .on("drag.d3adaptor", d => {
                        layout_1.Layout.drag(d, d3.event);
                        d3layout.resume(); // restart annealing
                    })
                        .on("dragend.d3adaptor", layout_1.Layout.dragEnd);
                }
                if (!arguments.length)
                    return drag;
                // this is the context of the function, i.e. the d3 selection
                this //.on("mouseover.adaptor", colaMouseover)
                    .call(drag);
            };
        }
        trigger(e) {
            var d3event = { type: layout_1.EventType[e.type], alpha: e.alpha, stress: e.stress };
            this.event[d3event.type](d3event); // via d3 dispatcher, e.g. event.start(e);
        }
        // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
        kick() {
            d3.timer(() => super.tick());
        }
        // a function for binding to events on the adapter
        on(eventType, listener) {
            if (typeof eventType === 'string') {
                this.event.on(eventType, listener);
            }
            else {
                this.event.on(layout_1.EventType[eventType], listener);
            }
            return this;
        }
    }
    exports.D3StyleLayoutAdaptor = D3StyleLayoutAdaptor;
    /**
     * provides an interface for use with d3:
     * - uses the d3 event system to dispatch layout events such as:
     *   o "start" (start layout process)
     *   o "tick" (after each layout iteration)
     *   o "end" (layout converged and complete).
     * - uses the d3 timer to queue layout iterations.
     * - sets up d3.behavior.drag to drag nodes
     *   o use `node.call(<the returned instance of Layout>.drag)` to make nodes draggable
     * returns an instance of the cola.Layout itself with which the user
     * can interact directly.
     */
    function d3adaptor() {
        return new D3StyleLayoutAdaptor();
    }
    exports.d3adaptor = d3adaptor;
    },{"./layout":12}],7:[function(require,module,exports){
    "use strict";
    const layout_1 = require("./layout");
    class D3StyleLayoutAdaptor extends layout_1.Layout {
        constructor(d3Context) {
            super();
            this.d3Context = d3Context;
            this.event = d3Context.dispatch(layout_1.EventType[layout_1.EventType.start], layout_1.EventType[layout_1.EventType.tick], layout_1.EventType[layout_1.EventType.end]);
            // bit of trickyness remapping 'this' so we can reference it in the function body.
            var d3layout = this;
            var drag;
            this.drag = function () {
                if (!drag) {
                    var drag = d3Context.drag()
                        .subject(layout_1.Layout.dragOrigin)
                        .on("start.d3adaptor", layout_1.Layout.dragStart)
                        .on("drag.d3adaptor", d => {
                        layout_1.Layout.drag(d, d3Context.event);
                        d3layout.resume(); // restart annealing
                    })
                        .on("end.d3adaptor", layout_1.Layout.dragEnd);
                }
                if (!arguments.length)
                    return drag;
                // this is the context of the function, i.e. the d3 selection
                //this//.on("mouseover.adaptor", colaMouseover)
                //.on("mouseout.adaptor", colaMouseout)
                arguments[0].call(drag);
            };
        }
        trigger(e) {
            var d3event = { type: layout_1.EventType[e.type], alpha: e.alpha, stress: e.stress };
            // the dispatcher is actually expecting something of type EventTarget as the second argument
            // so passing the thing above is totally abusing the pattern... not sure what to do about this yet
            this.event.call(d3event.type, d3event); // via d3 dispatcher, e.g. event.start(e);
        }
        // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
        kick() {
            var t = this.d3Context.timer(() => super.tick() && t.stop());
        }
        // a function for binding to events on the adapter
        on(eventType, listener) {
            if (typeof eventType === 'string') {
                this.event.on(eventType, listener);
            }
            else {
                this.event.on(layout_1.EventType[eventType], listener);
            }
            return this;
        }
    }
    exports.D3StyleLayoutAdaptor = D3StyleLayoutAdaptor;
    },{"./layout":12}],8:[function(require,module,exports){
    "use strict";
    /**
     * Descent respects a collection of locks over nodes that should not move
     * @class Locks
     */
    class Locks {
        constructor() {
            this.locks = {};
        }
        /**
         * add a lock on the node at index id
         * @method add
         * @param id index of node to be locked
         * @param x required position for node
         */
        add(id, x) {
            /* DEBUG
                        if (isNaN(x[0]) || isNaN(x[1])) debugger;
            DEBUG */
            this.locks[id] = x;
        }
        /**
         * @method clear clear all locks
         */
        clear() {
            this.locks = {};
        }
        /**
         * @isEmpty
         * @returns false if no locks exist
         */
        isEmpty() {
            for (var l in this.locks)
                return false;
            return true;
        }
        /**
         * perform an operation on each lock
         * @apply
         */
        apply(f) {
            for (var l in this.locks) {
                f(Number(l), this.locks[l]);
            }
        }
    }
    exports.Locks = Locks;
    /**
     * Uses a gradient descent approach to reduce a stress or p-stress goal function over a graph with specified ideal edge lengths or a square matrix of dissimilarities.
     * The standard stress function over a graph nodes with position vectors x,y,z is (mathematica input):
     *   stress[x_,y_,z_,D_,w_]:=Sum[w[[i,j]] (length[x[[i]],y[[i]],z[[i]],x[[j]],y[[j]],z[[j]]]-d[[i,j]])^2,{i,Length[x]-1},{j,i+1,Length[x]}]
     * where: D is a square matrix of ideal separations between nodes, w is matrix of weights for those separations
     *        length[x1_, y1_, z1_, x2_, y2_, z2_] = Sqrt[(x1 - x2)^2 + (y1 - y2)^2 + (z1 - z2)^2]
     * below, we use wij = 1/(Dij^2)
     *
     * @class Descent
     */
    class Descent {
        /**
         * @method constructor
         * @param x {number[][]} initial coordinates for nodes
         * @param D {number[][]} matrix of desired distances between pairs of nodes
         * @param G {number[][]} [default=null] if specified, G is a matrix of weights for goal terms between pairs of nodes.
         * If G[i][j] > 1 and the separation between nodes i and j is greater than their ideal distance, then there is no contribution for this pair to the goal
         * If G[i][j] <= 1 then it is used as a weighting on the contribution of the variance between ideal and actual separation between i and j to the goal function
         */
        constructor(x, D, G = null) {
            this.D = D;
            this.G = G;
            this.threshold = 0.0001;
            // Parameters for grid snap stress.
            // TODO: Make a pluggable "StressTerm" class instead of this
            // mess.
            this.numGridSnapNodes = 0;
            this.snapGridSize = 100;
            this.snapStrength = 1000;
            this.scaleSnapByMaxH = false;
            this.random = new PseudoRandom();
            this.project = null;
            this.x = x;
            this.k = x.length; // dimensionality
            var n = this.n = x[0].length; // number of nodes
            this.H = new Array(this.k);
            this.g = new Array(this.k);
            this.Hd = new Array(this.k);
            this.a = new Array(this.k);
            this.b = new Array(this.k);
            this.c = new Array(this.k);
            this.d = new Array(this.k);
            this.e = new Array(this.k);
            this.ia = new Array(this.k);
            this.ib = new Array(this.k);
            this.xtmp = new Array(this.k);
            this.locks = new Locks();
            this.minD = Number.MAX_VALUE;
            var i = n, j;
            while (i--) {
                j = n;
                while (--j > i) {
                    var d = D[i][j];
                    if (d > 0 && d < this.minD) {
                        this.minD = d;
                    }
                }
            }
            if (this.minD === Number.MAX_VALUE)
                this.minD = 1;
            i = this.k;
            while (i--) {
                this.g[i] = new Array(n);
                this.H[i] = new Array(n);
                j = n;
                while (j--) {
                    this.H[i][j] = new Array(n);
                }
                this.Hd[i] = new Array(n);
                this.a[i] = new Array(n);
                this.b[i] = new Array(n);
                this.c[i] = new Array(n);
                this.d[i] = new Array(n);
                this.e[i] = new Array(n);
                this.ia[i] = new Array(n);
                this.ib[i] = new Array(n);
                this.xtmp[i] = new Array(n);
            }
        }
        static createSquareMatrix(n, f) {
            var M = new Array(n);
            for (var i = 0; i < n; ++i) {
                M[i] = new Array(n);
                for (var j = 0; j < n; ++j) {
                    M[i][j] = f(i, j);
                }
            }
            return M;
        }
        offsetDir() {
            var u = new Array(this.k);
            var l = 0;
            for (var i = 0; i < this.k; ++i) {
                var x = u[i] = this.random.getNextBetween(0.01, 1) - 0.5;
                l += x * x;
            }
            l = Math.sqrt(l);
            return u.map(x => x *= this.minD / l);
        }
        // compute first and second derivative information storing results in this.g and this.H
        computeDerivatives(x) {
            var n = this.n;
            if (n < 1)
                return;
            var i;
            /* DEBUG
                        for (var u: number = 0; u < n; ++u)
                            for (i = 0; i < this.k; ++i)
                                if (isNaN(x[i][u])) debugger;
            DEBUG */
            var d = new Array(this.k);
            var d2 = new Array(this.k);
            var Huu = new Array(this.k);
            var maxH = 0;
            for (var u = 0; u < n; ++u) {
                for (i = 0; i < this.k; ++i)
                    Huu[i] = this.g[i][u] = 0;
                for (var v = 0; v < n; ++v) {
                    if (u === v)
                        continue;
                    // The following loop randomly displaces nodes that are at identical positions
                    var maxDisplaces = n; // avoid infinite loop in the case of numerical issues, such as huge values
                    while (maxDisplaces--) {
                        var sd2 = 0;
                        for (i = 0; i < this.k; ++i) {
                            var dx = d[i] = x[i][u] - x[i][v];
                            sd2 += d2[i] = dx * dx;
                        }
                        if (sd2 > 1e-9)
                            break;
                        var rd = this.offsetDir();
                        for (i = 0; i < this.k; ++i)
                            x[i][v] += rd[i];
                    }
                    var l = Math.sqrt(sd2);
                    var D = this.D[u][v];
                    var weight = this.G != null ? this.G[u][v] : 1;
                    if (weight > 1 && l > D || !isFinite(D)) {
                        for (i = 0; i < this.k; ++i)
                            this.H[i][u][v] = 0;
                        continue;
                    }
                    if (weight > 1) {
                        weight = 1;
                    }
                    var D2 = D * D;
                    var gs = 2 * weight * (l - D) / (D2 * l);
                    var l3 = l * l * l;
                    var hs = 2 * -weight / (D2 * l3);
                    if (!isFinite(gs))
                        console.log(gs);
                    for (i = 0; i < this.k; ++i) {
                        this.g[i][u] += d[i] * gs;
                        Huu[i] -= this.H[i][u][v] = hs * (l3 + D * (d2[i] - sd2) + l * sd2);
                    }
                }
                for (i = 0; i < this.k; ++i)
                    maxH = Math.max(maxH, this.H[i][u][u] = Huu[i]);
            }
            // Grid snap forces
            var r = this.snapGridSize / 2;
            var g = this.snapGridSize;
            var w = this.snapStrength;
            var k = w / (r * r);
            var numNodes = this.numGridSnapNodes;
            //var numNodes = n;
            for (var u = 0; u < numNodes; ++u) {
                for (i = 0; i < this.k; ++i) {
                    var xiu = this.x[i][u];
                    var m = xiu / g;
                    var f = m % 1;
                    var q = m - f;
                    var a = Math.abs(f);
                    var dx = (a <= 0.5) ? xiu - q * g :
                        (xiu > 0) ? xiu - (q + 1) * g : xiu - (q - 1) * g;
                    if (-r < dx && dx <= r) {
                        if (this.scaleSnapByMaxH) {
                            this.g[i][u] += maxH * k * dx;
                            this.H[i][u][u] += maxH * k;
                        }
                        else {
                            this.g[i][u] += k * dx;
                            this.H[i][u][u] += k;
                        }
                    }
                }
            }
            if (!this.locks.isEmpty()) {
                this.locks.apply((u, p) => {
                    for (i = 0; i < this.k; ++i) {
                        this.H[i][u][u] += maxH;
                        this.g[i][u] -= maxH * (p[i] - x[i][u]);
                    }
                });
            }
            /* DEBUG
                        for (var u: number = 0; u < n; ++u)
                            for (i = 0; i < this.k; ++i) {
                                if (isNaN(this.g[i][u])) debugger;
                                for (var v: number = 0; v < n; ++v)
                                    if (isNaN(this.H[i][u][v])) debugger;
                            }
            DEBUG */
        }
        static dotProd(a, b) {
            var x = 0, i = a.length;
            while (i--)
                x += a[i] * b[i];
            return x;
        }
        // result r = matrix m * vector v
        static rightMultiply(m, v, r) {
            var i = m.length;
            while (i--)
                r[i] = Descent.dotProd(m[i], v);
        }
        // computes the optimal step size to take in direction d using the
        // derivative information in this.g and this.H
        // returns the scalar multiplier to apply to d to get the optimal step
        computeStepSize(d) {
            var numerator = 0, denominator = 0;
            for (var i = 0; i < this.k; ++i) {
                numerator += Descent.dotProd(this.g[i], d[i]);
                Descent.rightMultiply(this.H[i], d[i], this.Hd[i]);
                denominator += Descent.dotProd(d[i], this.Hd[i]);
            }
            if (denominator === 0 || !isFinite(denominator))
                return 0;
            return 1 * numerator / denominator;
        }
        reduceStress() {
            this.computeDerivatives(this.x);
            var alpha = this.computeStepSize(this.g);
            for (var i = 0; i < this.k; ++i) {
                this.takeDescentStep(this.x[i], this.g[i], alpha);
            }
            return this.computeStress();
        }
        static copy(a, b) {
            var m = a.length, n = b[0].length;
            for (var i = 0; i < m; ++i) {
                for (var j = 0; j < n; ++j) {
                    b[i][j] = a[i][j];
                }
            }
        }
        // takes a step of stepSize * d from x0, and then project against any constraints.
        // result is returned in r.
        // x0: starting positions
        // r: result positions will be returned here
        // d: unconstrained descent vector
        // stepSize: amount to step along d
        stepAndProject(x0, r, d, stepSize) {
            Descent.copy(x0, r);
            this.takeDescentStep(r[0], d[0], stepSize);
            if (this.project)
                this.project[0](x0[0], x0[1], r[0]);
            this.takeDescentStep(r[1], d[1], stepSize);
            if (this.project)
                this.project[1](r[0], x0[1], r[1]);
            // todo: allow projection against constraints in higher dimensions
            for (var i = 2; i < this.k; i++)
                this.takeDescentStep(r[i], d[i], stepSize);
            // the following makes locks extra sticky... but hides the result of the projection from the consumer
            //if (!this.locks.isEmpty()) {
            //    this.locks.apply((u, p) => {
            //        for (var i = 0; i < this.k; i++) {
            //            r[i][u] = p[i];
            //        }
            //    });
            //}
        }
        static mApply(m, n, f) {
            var i = m;
            while (i-- > 0) {
                var j = n;
                while (j-- > 0)
                    f(i, j);
            }
        }
        matrixApply(f) {
            Descent.mApply(this.k, this.n, f);
        }
        computeNextPosition(x0, r) {
            this.computeDerivatives(x0);
            var alpha = this.computeStepSize(this.g);
            this.stepAndProject(x0, r, this.g, alpha);
            /* DEBUG
                        for (var u: number = 0; u < this.n; ++u)
                            for (var i = 0; i < this.k; ++i)
                                if (isNaN(r[i][u])) debugger;
            DEBUG */
            if (this.project) {
                this.matrixApply((i, j) => this.e[i][j] = x0[i][j] - r[i][j]);
                var beta = this.computeStepSize(this.e);
                beta = Math.max(0.2, Math.min(beta, 1));
                this.stepAndProject(x0, r, this.e, beta);
            }
        }
        run(iterations) {
            var stress = Number.MAX_VALUE, converged = false;
            while (!converged && iterations-- > 0) {
                var s = this.rungeKutta();
                converged = Math.abs(stress / s - 1) < this.threshold;
                stress = s;
            }
            return stress;
        }
        rungeKutta() {
            this.computeNextPosition(this.x, this.a);
            Descent.mid(this.x, this.a, this.ia);
            this.computeNextPosition(this.ia, this.b);
            Descent.mid(this.x, this.b, this.ib);
            this.computeNextPosition(this.ib, this.c);
            this.computeNextPosition(this.c, this.d);
            var disp = 0;
            this.matrixApply((i, j) => {
                var x = (this.a[i][j] + 2.0 * this.b[i][j] + 2.0 * this.c[i][j] + this.d[i][j]) / 6.0, d = this.x[i][j] - x;
                disp += d * d;
                this.x[i][j] = x;
            });
            return disp;
        }
        static mid(a, b, m) {
            Descent.mApply(a.length, a[0].length, (i, j) => m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0);
        }
        takeDescentStep(x, d, stepSize) {
            for (var i = 0; i < this.n; ++i) {
                x[i] = x[i] - stepSize * d[i];
            }
        }
        computeStress() {
            var stress = 0;
            for (var u = 0, nMinus1 = this.n - 1; u < nMinus1; ++u) {
                for (var v = u + 1, n = this.n; v < n; ++v) {
                    var l = 0;
                    for (var i = 0; i < this.k; ++i) {
                        var dx = this.x[i][u] - this.x[i][v];
                        l += dx * dx;
                    }
                    l = Math.sqrt(l);
                    var d = this.D[u][v];
                    if (!isFinite(d))
                        continue;
                    var rl = d - l;
                    var d2 = d * d;
                    stress += rl * rl / d2;
                }
            }
            return stress;
        }
    }
    Descent.zeroDistance = 1e-10;
    exports.Descent = Descent;
    // Linear congruential pseudo random number generator
    class PseudoRandom {
        constructor(seed = 1) {
            this.seed = seed;
            this.a = 214013;
            this.c = 2531011;
            this.m = 2147483648;
            this.range = 32767;
        }
        // random real between 0 and 1
        getNext() {
            this.seed = (this.seed * this.a + this.c) % this.m;
            return (this.seed >> 16) / this.range;
        }
        // random real between min and max
        getNextBetween(min, max) {
            return min + this.getNext() * (max - min);
        }
    }
    exports.PseudoRandom = PseudoRandom;
    },{}],9:[function(require,module,exports){
    "use strict";
    const rectangle_1 = require("./rectangle");
    class Point {
    }
    exports.Point = Point;
    class LineSegment {
        constructor(x1, y1, x2, y2) {
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
        }
    }
    exports.LineSegment = LineSegment;
    class PolyPoint extends Point {
    }
    exports.PolyPoint = PolyPoint;
    /** tests if a point is Left|On|Right of an infinite line.
     * @param points P0, P1, and P2
     * @return >0 for P2 left of the line through P0 and P1
     *            =0 for P2 on the line
     *            <0 for P2 right of the line
     */
    function isLeft(P0, P1, P2) {
        return (P1.x - P0.x) * (P2.y - P0.y) - (P2.x - P0.x) * (P1.y - P0.y);
    }
    exports.isLeft = isLeft;
    function above(p, vi, vj) {
        return isLeft(p, vi, vj) > 0;
    }
    function below(p, vi, vj) {
        return isLeft(p, vi, vj) < 0;
    }
    /**
     * returns the convex hull of a set of points using Andrew's monotone chain algorithm
     * see: http://geomalgorithms.com/a10-_hull-1.html#Monotone%20Chain
     * @param S array of points
     * @return the convex hull as an array of points
     */
    function ConvexHull(S) {
        var P = S.slice(0).sort((a, b) => a.x !== b.x ? b.x - a.x : b.y - a.y);
        var n = S.length, i;
        var minmin = 0;
        var xmin = P[0].x;
        for (i = 1; i < n; ++i) {
            if (P[i].x !== xmin)
                break;
        }
        var minmax = i - 1;
        var H = [];
        H.push(P[minmin]); // push minmin point onto stack
        if (minmax === n - 1) {
            if (P[minmax].y !== P[minmin].y)
                H.push(P[minmax]);
        }
        else {
            // Get the indices of points with max x-coord and min|max y-coord
            var maxmin, maxmax = n - 1;
            var xmax = P[n - 1].x;
            for (i = n - 2; i >= 0; i--)
                if (P[i].x !== xmax)
                    break;
            maxmin = i + 1;
            // Compute the lower hull on the stack H
            i = minmax;
            while (++i <= maxmin) {
                // the lower line joins P[minmin]  with P[maxmin]
                if (isLeft(P[minmin], P[maxmin], P[i]) >= 0 && i < maxmin)
                    continue; // ignore P[i] above or on the lower line
                while (H.length > 1) {
                    // test if  P[i] is left of the line at the stack top
                    if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                        break; // P[i] is a new hull  vertex
                    else
                        H.length -= 1; // pop top point off  stack
                }
                if (i != minmin)
                    H.push(P[i]);
            }
            // Next, compute the upper hull on the stack H above the bottom hull
            if (maxmax != maxmin)
                H.push(P[maxmax]); // push maxmax point onto stack
            var bot = H.length; // the bottom point of the upper hull stack
            i = maxmin;
            while (--i >= minmax) {
                // the upper line joins P[maxmax]  with P[minmax]
                if (isLeft(P[maxmax], P[minmax], P[i]) >= 0 && i > minmax)
                    continue; // ignore P[i] below or on the upper line
                while (H.length > bot) {
                    // test if  P[i] is left of the line at the stack top
                    if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                        break; // P[i] is a new hull  vertex
                    else
                        H.length -= 1; // pop top point off  stack
                }
                if (i != minmin)
                    H.push(P[i]); // push P[i] onto stack
            }
        }
        return H;
    }
    exports.ConvexHull = ConvexHull;
    // apply f to the points in P in clockwise order around the point p
    function clockwiseRadialSweep(p, P, f) {
        P.slice(0).sort((a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x)).forEach(f);
    }
    exports.clockwiseRadialSweep = clockwiseRadialSweep;
    function nextPolyPoint(p, ps) {
        if (p.polyIndex === ps.length - 1)
            return ps[0];
        return ps[p.polyIndex + 1];
    }
    function prevPolyPoint(p, ps) {
        if (p.polyIndex === 0)
            return ps[ps.length - 1];
        return ps[p.polyIndex - 1];
    }
    // tangent_PointPolyC(): fast binary search for tangents to a convex polygon
    //    Input:  P = a 2D point (exterior to the polygon)
    //            n = number of polygon vertices
    //            V = array of vertices for a 2D convex polygon with V[n] = V[0]
    //    Output: rtan = index of rightmost tangent point V[rtan]
    //            ltan = index of leftmost tangent point V[ltan]
    function tangent_PointPolyC(P, V) {
        return { rtan: Rtangent_PointPolyC(P, V), ltan: Ltangent_PointPolyC(P, V) };
    }
    // Rtangent_PointPolyC(): binary search for convex polygon right tangent
    //    Input:  P = a 2D point (exterior to the polygon)
    //            n = number of polygon vertices
    //            V = array of vertices for a 2D convex polygon with V[n] = V[0]
    //    Return: index "i" of rightmost tangent point V[i]
    function Rtangent_PointPolyC(P, V) {
        var n = V.length - 1;
        // use binary search for large convex polygons
        var a, b, c; // indices for edge chain endpoints
        var upA, dnC; // test for up direction of edges a and c
        // rightmost tangent = maximum for the isLeft() ordering
        // test if V[0] is a local maximum
        if (below(P, V[1], V[0]) && !above(P, V[n - 1], V[0]))
            return 0; // V[0] is the maximum tangent point
        for (a = 0, b = n;;) {
            if (b - a === 1)
                if (above(P, V[a], V[b]))
                    return a;
                else
                    return b;
            c = Math.floor((a + b) / 2); // midpoint of [a,b], and 0<c<n
            dnC = below(P, V[c + 1], V[c]);
            if (dnC && !above(P, V[c - 1], V[c]))
                return c; // V[c] is the maximum tangent point
            // no max yet, so continue with the binary search
            // pick one of the two subchains [a,c] or [c,b]
            upA = above(P, V[a + 1], V[a]);
            if (upA) {
                if (dnC)
                    b = c; // select [a,c]
                else {
                    if (above(P, V[a], V[c]))
                        b = c; // select [a,c]
                    else
                        a = c; // select [c,b]
                }
            }
            else {
                if (!dnC)
                    a = c; // select [c,b]
                else {
                    if (below(P, V[a], V[c]))
                        b = c; // select [a,c]
                    else
                        a = c; // select [c,b]
                }
            }
        }
    }
    // Ltangent_PointPolyC(): binary search for convex polygon left tangent
    //    Input:  P = a 2D point (exterior to the polygon)
    //            n = number of polygon vertices
    //            V = array of vertices for a 2D convex polygon with V[n]=V[0]
    //    Return: index "i" of leftmost tangent point V[i]
    function Ltangent_PointPolyC(P, V) {
        var n = V.length - 1;
        // use binary search for large convex polygons
        var a, b, c; // indices for edge chain endpoints
        var dnA, dnC; // test for down direction of edges a and c
        // leftmost tangent = minimum for the isLeft() ordering
        // test if V[0] is a local minimum
        if (above(P, V[n - 1], V[0]) && !below(P, V[1], V[0]))
            return 0; // V[0] is the minimum tangent point
        for (a = 0, b = n;;) {
            if (b - a === 1)
                if (below(P, V[a], V[b]))
                    return a;
                else
                    return b;
            c = Math.floor((a + b) / 2); // midpoint of [a,b], and 0<c<n
            dnC = below(P, V[c + 1], V[c]);
            if (above(P, V[c - 1], V[c]) && !dnC)
                return c; // V[c] is the minimum tangent point
            // no min yet, so continue with the binary search
            // pick one of the two subchains [a,c] or [c,b]
            dnA = below(P, V[a + 1], V[a]);
            if (dnA) {
                if (!dnC)
                    b = c; // select [a,c]
                else {
                    if (below(P, V[a], V[c]))
                        b = c; // select [a,c]
                    else
                        a = c; // select [c,b]
                }
            }
            else {
                if (dnC)
                    a = c; // select [c,b]
                else {
                    if (above(P, V[a], V[c]))
                        b = c; // select [a,c]
                    else
                        a = c; // select [c,b]
                }
            }
        }
    }
    // RLtangent_PolyPolyC(): get the RL tangent between two convex polygons
    //    Input:  m = number of vertices in polygon 1
    //            V = array of vertices for convex polygon 1 with V[m]=V[0]
    //            n = number of vertices in polygon 2
    //            W = array of vertices for convex polygon 2 with W[n]=W[0]
    //    Output: *t1 = index of tangent point V[t1] for polygon 1
    //            *t2 = index of tangent point W[t2] for polygon 2
    function tangent_PolyPolyC(V, W, t1, t2, cmp1, cmp2) {
        var ix1, ix2; // search indices for polygons 1 and 2
        // first get the initial vertex on each polygon
        ix1 = t1(W[0], V); // right tangent from W[0] to V
        ix2 = t2(V[ix1], W); // left tangent from V[ix1] to W
        // ping-pong linear search until it stabilizes
        var done = false; // flag when done
        while (!done) {
            done = true; // assume done until...
            while (true) {
                if (ix1 === V.length - 1)
                    ix1 = 0;
                if (cmp1(W[ix2], V[ix1], V[ix1 + 1]))
                    break;
                ++ix1; // get Rtangent from W[ix2] to V
            }
            while (true) {
                if (ix2 === 0)
                    ix2 = W.length - 1;
                if (cmp2(V[ix1], W[ix2], W[ix2 - 1]))
                    break;
                --ix2; // get Ltangent from V[ix1] to W
                done = false; // not done if had to adjust this
            }
        }
        return { t1: ix1, t2: ix2 };
    }
    exports.tangent_PolyPolyC = tangent_PolyPolyC;
    function LRtangent_PolyPolyC(V, W) {
        var rl = RLtangent_PolyPolyC(W, V);
        return { t1: rl.t2, t2: rl.t1 };
    }
    exports.LRtangent_PolyPolyC = LRtangent_PolyPolyC;
    function RLtangent_PolyPolyC(V, W) {
        return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Ltangent_PointPolyC, above, below);
    }
    exports.RLtangent_PolyPolyC = RLtangent_PolyPolyC;
    function LLtangent_PolyPolyC(V, W) {
        return tangent_PolyPolyC(V, W, Ltangent_PointPolyC, Ltangent_PointPolyC, below, below);
    }
    exports.LLtangent_PolyPolyC = LLtangent_PolyPolyC;
    function RRtangent_PolyPolyC(V, W) {
        return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Rtangent_PointPolyC, above, above);
    }
    exports.RRtangent_PolyPolyC = RRtangent_PolyPolyC;
    class BiTangent {
        constructor(t1, t2) {
            this.t1 = t1;
            this.t2 = t2;
        }
    }
    exports.BiTangent = BiTangent;
    class BiTangents {
    }
    exports.BiTangents = BiTangents;
    class TVGPoint extends Point {
    }
    exports.TVGPoint = TVGPoint;
    class VisibilityVertex {
        constructor(id, polyid, polyvertid, p) {
            this.id = id;
            this.polyid = polyid;
            this.polyvertid = polyvertid;
            this.p = p;
            p.vv = this;
        }
    }
    exports.VisibilityVertex = VisibilityVertex;
    class VisibilityEdge {
        constructor(source, target) {
            this.source = source;
            this.target = target;
        }
        length() {
            var dx = this.source.p.x - this.target.p.x;
            var dy = this.source.p.y - this.target.p.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
    }
    exports.VisibilityEdge = VisibilityEdge;
    class TangentVisibilityGraph {
        constructor(P, g0) {
            this.P = P;
            this.V = [];
            this.E = [];
            if (!g0) {
                var n = P.length;
                for (var i = 0; i < n; i++) {
                    var p = P[i];
                    for (var j = 0; j < p.length; ++j) {
                        var pj = p[j], vv = new VisibilityVertex(this.V.length, i, j, pj);
                        this.V.push(vv);
                        if (j > 0)
                            this.E.push(new VisibilityEdge(p[j - 1].vv, vv));
                    }
                }
                for (var i = 0; i < n - 1; i++) {
                    var Pi = P[i];
                    for (var j = i + 1; j < n; j++) {
                        var Pj = P[j], t = tangents(Pi, Pj);
                        for (var q in t) {
                            var c = t[q], source = Pi[c.t1], target = Pj[c.t2];
                            this.addEdgeIfVisible(source, target, i, j);
                        }
                    }
                }
            }
            else {
                this.V = g0.V.slice(0);
                this.E = g0.E.slice(0);
            }
        }
        addEdgeIfVisible(u, v, i1, i2) {
            if (!this.intersectsPolys(new LineSegment(u.x, u.y, v.x, v.y), i1, i2)) {
                this.E.push(new VisibilityEdge(u.vv, v.vv));
            }
        }
        addPoint(p, i1) {
            var n = this.P.length;
            this.V.push(new VisibilityVertex(this.V.length, n, 0, p));
            for (var i = 0; i < n; ++i) {
                if (i === i1)
                    continue;
                var poly = this.P[i], t = tangent_PointPolyC(p, poly);
                this.addEdgeIfVisible(p, poly[t.ltan], i1, i);
                this.addEdgeIfVisible(p, poly[t.rtan], i1, i);
            }
            return p.vv;
        }
        intersectsPolys(l, i1, i2) {
            for (var i = 0, n = this.P.length; i < n; ++i) {
                if (i != i1 && i != i2 && intersects(l, this.P[i]).length > 0) {
                    return true;
                }
            }
            return false;
        }
    }
    exports.TangentVisibilityGraph = TangentVisibilityGraph;
    function intersects(l, P) {
        var ints = [];
        for (var i = 1, n = P.length; i < n; ++i) {
            var int = rectangle_1.Rectangle.lineIntersection(l.x1, l.y1, l.x2, l.y2, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y);
            if (int)
                ints.push(int);
        }
        return ints;
    }
    function tangents(V, W) {
        var m = V.length - 1, n = W.length - 1;
        var bt = new BiTangents();
        for (var i = 0; i < m; ++i) {
            for (var j = 0; j < n; ++j) {
                var v1 = V[i == 0 ? m - 1 : i - 1];
                var v2 = V[i];
                var v3 = V[i + 1];
                var w1 = W[j == 0 ? n - 1 : j - 1];
                var w2 = W[j];
                var w3 = W[j + 1];
                var v1v2w2 = isLeft(v1, v2, w2);
                var v2w1w2 = isLeft(v2, w1, w2);
                var v2w2w3 = isLeft(v2, w2, w3);
                var w1w2v2 = isLeft(w1, w2, v2);
                var w2v1v2 = isLeft(w2, v1, v2);
                var w2v2v3 = isLeft(w2, v2, v3);
                if (v1v2w2 >= 0 && v2w1w2 >= 0 && v2w2w3 < 0
                    && w1w2v2 >= 0 && w2v1v2 >= 0 && w2v2v3 < 0) {
                    bt.ll = new BiTangent(i, j);
                }
                else if (v1v2w2 <= 0 && v2w1w2 <= 0 && v2w2w3 > 0
                    && w1w2v2 <= 0 && w2v1v2 <= 0 && w2v2v3 > 0) {
                    bt.rr = new BiTangent(i, j);
                }
                else if (v1v2w2 <= 0 && v2w1w2 > 0 && v2w2w3 <= 0
                    && w1w2v2 >= 0 && w2v1v2 < 0 && w2v2v3 >= 0) {
                    bt.rl = new BiTangent(i, j);
                }
                else if (v1v2w2 >= 0 && v2w1w2 < 0 && v2w2w3 >= 0
                    && w1w2v2 <= 0 && w2v1v2 > 0 && w2v2v3 <= 0) {
                    bt.lr = new BiTangent(i, j);
                }
            }
        }
        return bt;
    }
    exports.tangents = tangents;
    function isPointInsidePoly(p, poly) {
        for (var i = 1, n = poly.length; i < n; ++i)
            if (below(poly[i - 1], poly[i], p))
                return false;
        return true;
    }
    function isAnyPInQ(p, q) {
        return !p.every(v => !isPointInsidePoly(v, q));
    }
    function polysOverlap(p, q) {
        if (isAnyPInQ(p, q))
            return true;
        if (isAnyPInQ(q, p))
            return true;
        for (var i = 1, n = p.length; i < n; ++i) {
            var v = p[i], u = p[i - 1];
            if (intersects(new LineSegment(u.x, u.y, v.x, v.y), q).length > 0)
                return true;
        }
        return false;
    }
    exports.polysOverlap = polysOverlap;
    },{"./rectangle":18}],10:[function(require,module,exports){
    "use strict";
    const rectangle_1 = require("./rectangle");
    const vpsc_1 = require("./vpsc");
    const shortestpaths_1 = require("./shortestpaths");
    class NodeWrapper {
        constructor(id, rect, children) {
            this.id = id;
            this.rect = rect;
            this.children = children;
            this.leaf = typeof children === 'undefined' || children.length === 0;
        }
    }
    exports.NodeWrapper = NodeWrapper;
    class Vert {
        constructor(id, x, y, node = null, line = null) {
            this.id = id;
            this.x = x;
            this.y = y;
            this.node = node;
            this.line = line;
        }
    }
    exports.Vert = Vert;
    class LongestCommonSubsequence {
        constructor(s, t) {
            this.s = s;
            this.t = t;
            var mf = LongestCommonSubsequence.findMatch(s, t);
            var tr = t.slice(0).reverse();
            var mr = LongestCommonSubsequence.findMatch(s, tr);
            if (mf.length >= mr.length) {
                this.length = mf.length;
                this.si = mf.si;
                this.ti = mf.ti;
                this.reversed = false;
            }
            else {
                this.length = mr.length;
                this.si = mr.si;
                this.ti = t.length - mr.ti - mr.length;
                this.reversed = true;
            }
        }
        static findMatch(s, t) {
            var m = s.length;
            var n = t.length;
            var match = { length: 0, si: -1, ti: -1 };
            var l = new Array(m);
            for (var i = 0; i < m; i++) {
                l[i] = new Array(n);
                for (var j = 0; j < n; j++)
                    if (s[i] === t[j]) {
                        var v = l[i][j] = (i === 0 || j === 0) ? 1 : l[i - 1][j - 1] + 1;
                        if (v > match.length) {
                            match.length = v;
                            match.si = i - v + 1;
                            match.ti = j - v + 1;
                        }
                        ;
                    }
                    else
                        l[i][j] = 0;
            }
            return match;
        }
        getSequence() {
            return this.length >= 0 ? this.s.slice(this.si, this.si + this.length) : [];
        }
    }
    exports.LongestCommonSubsequence = LongestCommonSubsequence;
    class GridRouter {
        constructor(originalnodes, accessor, groupPadding = 12) {
            this.originalnodes = originalnodes;
            this.groupPadding = groupPadding;
            this.leaves = null;
            this.nodes = originalnodes.map((v, i) => new NodeWrapper(i, accessor.getBounds(v), accessor.getChildren(v)));
            this.leaves = this.nodes.filter(v => v.leaf);
            this.groups = this.nodes.filter(g => !g.leaf);
            this.cols = this.getGridLines('x');
            this.rows = this.getGridLines('y');
            // create parents for each node or group that is a member of another's children
            this.groups.forEach(v => v.children.forEach(c => this.nodes[c].parent = v));
            // root claims the remaining orphans
            this.root = { children: [] };
            this.nodes.forEach(v => {
                if (typeof v.parent === 'undefined') {
                    v.parent = this.root;
                    this.root.children.push(v.id);
                }
                // each node will have grid vertices associated with it,
                // some inside the node and some on the boundary
                // leaf nodes will have exactly one internal node at the center
                // and four boundary nodes
                // groups will have potentially many of each
                v.ports = [];
            });
            // nodes ordered by their position in the group hierarchy
            this.backToFront = this.nodes.slice(0);
            this.backToFront.sort((x, y) => this.getDepth(x) - this.getDepth(y));
            // compute boundary rectangles for each group
            // has to be done from front to back, i.e. inside groups to outside groups
            // such that each can be made large enough to enclose its interior
            var frontToBackGroups = this.backToFront.slice(0).reverse().filter(g => !g.leaf);
            frontToBackGroups.forEach(v => {
                var r = rectangle_1.Rectangle.empty();
                v.children.forEach(c => r = r.union(this.nodes[c].rect));
                v.rect = r.inflate(this.groupPadding);
            });
            var colMids = this.midPoints(this.cols.map(r => r.pos));
            var rowMids = this.midPoints(this.rows.map(r => r.pos));
            // setup extents of lines
            var rowx = colMids[0], rowX = colMids[colMids.length - 1];
            var coly = rowMids[0], colY = rowMids[rowMids.length - 1];
            // horizontal lines
            var hlines = this.rows.map(r => ({ x1: rowx, x2: rowX, y1: r.pos, y2: r.pos }))
                .concat(rowMids.map(m => ({ x1: rowx, x2: rowX, y1: m, y2: m })));
            // vertical lines
            var vlines = this.cols.map(c => ({ x1: c.pos, x2: c.pos, y1: coly, y2: colY }))
                .concat(colMids.map(m => ({ x1: m, x2: m, y1: coly, y2: colY })));
            // the full set of lines
            var lines = hlines.concat(vlines);
            // we record the vertices associated with each line
            lines.forEach(l => l.verts = []);
            // the routing graph
            this.verts = [];
            this.edges = [];
            // create vertices at the crossings of horizontal and vertical grid-lines
            hlines.forEach(h => vlines.forEach(v => {
                var p = new Vert(this.verts.length, v.x1, h.y1);
                h.verts.push(p);
                v.verts.push(p);
                this.verts.push(p);
                // assign vertices to the nodes immediately under them
                var i = this.backToFront.length;
                while (i-- > 0) {
                    var node = this.backToFront[i], r = node.rect;
                    var dx = Math.abs(p.x - r.cx()), dy = Math.abs(p.y - r.cy());
                    if (dx < r.width() / 2 && dy < r.height() / 2) {
                        p.node = node;
                        break;
                    }
                }
            }));
            lines.forEach((l, li) => {
                // create vertices at the intersections of nodes and lines
                this.nodes.forEach((v, i) => {
                    v.rect.lineIntersections(l.x1, l.y1, l.x2, l.y2).forEach((intersect, j) => {
                        //console.log(li+','+i+','+j+':'+intersect.x + ',' + intersect.y);
                        var p = new Vert(this.verts.length, intersect.x, intersect.y, v, l);
                        this.verts.push(p);
                        l.verts.push(p);
                        v.ports.push(p);
                    });
                });
                // split lines into edges joining vertices
                var isHoriz = Math.abs(l.y1 - l.y2) < 0.1;
                var delta = (a, b) => isHoriz ? b.x - a.x : b.y - a.y;
                l.verts.sort(delta);
                for (var i = 1; i < l.verts.length; i++) {
                    var u = l.verts[i - 1], v = l.verts[i];
                    if (u.node && u.node === v.node && u.node.leaf)
                        continue;
                    this.edges.push({ source: u.id, target: v.id, length: Math.abs(delta(u, v)) });
                }
            });
        }
        avg(a) { return a.reduce((x, y) => x + y) / a.length; }
        // in the given axis, find sets of leaves overlapping in that axis
        // center of each GridLine is average of all nodes in column
        getGridLines(axis) {
            var columns = [];
            var ls = this.leaves.slice(0, this.leaves.length);
            while (ls.length > 0) {
                // find a column of all leaves overlapping in axis with the first leaf
                let overlapping = ls.filter(v => v.rect['overlap' + axis.toUpperCase()](ls[0].rect));
                let col = {
                    nodes: overlapping,
                    pos: this.avg(overlapping.map(v => v.rect['c' + axis]()))
                };
                columns.push(col);
                col.nodes.forEach(v => ls.splice(ls.indexOf(v), 1));
            }
            columns.sort((a, b) => a.pos - b.pos);
            return columns;
        }
        // get the depth of the given node in the group hierarchy
        getDepth(v) {
            var depth = 0;
            while (v.parent !== this.root) {
                depth++;
                v = v.parent;
            }
            return depth;
        }
        // medial axes between node centres and also boundary lines for the grid
        midPoints(a) {
            var gap = a[1] - a[0];
            var mids = [a[0] - gap / 2];
            for (var i = 1; i < a.length; i++) {
                mids.push((a[i] + a[i - 1]) / 2);
            }
            mids.push(a[a.length - 1] + gap / 2);
            return mids;
        }
        // find path from v to root including both v and root
        findLineage(v) {
            var lineage = [v];
            do {
                v = v.parent;
                lineage.push(v);
            } while (v !== this.root);
            return lineage.reverse();
        }
        // find path connecting a and b through their lowest common ancestor
        findAncestorPathBetween(a, b) {
            var aa = this.findLineage(a), ba = this.findLineage(b), i = 0;
            while (aa[i] === ba[i])
                i++;
            // i-1 to include common ancestor only once (as first element)
            return { commonAncestor: aa[i - 1], lineages: aa.slice(i).concat(ba.slice(i)) };
        }
        // when finding a path between two nodes a and b, siblings of a and b on the
        // paths from a and b to their least common ancestor are obstacles
        siblingObstacles(a, b) {
            var path = this.findAncestorPathBetween(a, b);
            var lineageLookup = {};
            path.lineages.forEach(v => lineageLookup[v.id] = {});
            var obstacles = path.commonAncestor.children.filter(v => !(v in lineageLookup));
            path.lineages
                .filter(v => v.parent !== path.commonAncestor)
                .forEach(v => obstacles = obstacles.concat(v.parent.children.filter(c => c !== v.id)));
            return obstacles.map(v => this.nodes[v]);
        }
        // for the given routes, extract all the segments orthogonal to the axis x
        // and return all them grouped by x position
        static getSegmentSets(routes, x, y) {
            // vsegments is a list of vertical segments sorted by x position
            var vsegments = [];
            for (var ei = 0; ei < routes.length; ei++) {
                var route = routes[ei];
                for (var si = 0; si < route.length; si++) {
                    var s = route[si];
                    s.edgeid = ei;
                    s.i = si;
                    var sdx = s[1][x] - s[0][x];
                    if (Math.abs(sdx) < 0.1) {
                        vsegments.push(s);
                    }
                }
            }
            vsegments.sort((a, b) => a[0][x] - b[0][x]);
            // vsegmentsets is a set of sets of segments grouped by x position
            var vsegmentsets = [];
            var segmentset = null;
            for (var i = 0; i < vsegments.length; i++) {
                var s = vsegments[i];
                if (!segmentset || Math.abs(s[0][x] - segmentset.pos) > 0.1) {
                    segmentset = { pos: s[0][x], segments: [] };
                    vsegmentsets.push(segmentset);
                }
                segmentset.segments.push(s);
            }
            return vsegmentsets;
        }
        // for all segments in this bundle create a vpsc problem such that
        // each segment's x position is a variable and separation constraints
        // are given by the partial order over the edges to which the segments belong
        // for each pair s1,s2 of segments in the open set:
        //   e1 = edge of s1, e2 = edge of s2
        //   if leftOf(e1,e2) create constraint s1.x + gap <= s2.x
        //   else if leftOf(e2,e1) create cons. s2.x + gap <= s1.x
        static nudgeSegs(x, y, routes, segments, leftOf, gap) {
            var n = segments.length;
            if (n <= 1)
                return;
            var vs = segments.map(s => new vpsc_1.Variable(s[0][x]));
            var cs = [];
            for (var i = 0; i < n; i++) {
                for (var j = 0; j < n; j++) {
                    if (i === j)
                        continue;
                    var s1 = segments[i], s2 = segments[j], e1 = s1.edgeid, e2 = s2.edgeid, lind = -1, rind = -1;
                    // in page coordinates (not cartesian) the notion of 'leftof' is flipped in the horizontal axis from the vertical axis
                    // that is, when nudging vertical segments, if they increase in the y(conj) direction the segment belonging to the
                    // 'left' edge actually needs to be nudged to the right
                    // when nudging horizontal segments, if the segments increase in the x direction
                    // then the 'left' segment needs to go higher, i.e. to have y pos less than that of the right
                    if (x == 'x') {
                        if (leftOf(e1, e2)) {
                            //console.log('s1: ' + s1[0][x] + ',' + s1[0][y] + '-' + s1[1][x] + ',' + s1[1][y]);
                            if (s1[0][y] < s1[1][y]) {
                                lind = j, rind = i;
                            }
                            else {
                                lind = i, rind = j;
                            }
                        }
                    }
                    else {
                        if (leftOf(e1, e2)) {
                            if (s1[0][y] < s1[1][y]) {
                                lind = i, rind = j;
                            }
                            else {
                                lind = j, rind = i;
                            }
                        }
                    }
                    if (lind >= 0) {
                        //console.log(x+' constraint: ' + lind + '<' + rind);
                        cs.push(new vpsc_1.Constraint(vs[lind], vs[rind], gap));
                    }
                }
            }
            var solver = new vpsc_1.Solver(vs, cs);
            solver.solve();
            vs.forEach((v, i) => {
                var s = segments[i];
                var pos = v.position();
                s[0][x] = s[1][x] = pos;
                var route = routes[s.edgeid];
                if (s.i > 0)
                    route[s.i - 1][1][x] = pos;
                if (s.i < route.length - 1)
                    route[s.i + 1][0][x] = pos;
            });
        }
        static nudgeSegments(routes, x, y, leftOf, gap) {
            var vsegmentsets = GridRouter.getSegmentSets(routes, x, y);
            // scan the grouped (by x) segment sets to find co-linear bundles
            for (var i = 0; i < vsegmentsets.length; i++) {
                var ss = vsegmentsets[i];
                var events = [];
                for (var j = 0; j < ss.segments.length; j++) {
                    var s = ss.segments[j];
                    events.push({ type: 0, s: s, pos: Math.min(s[0][y], s[1][y]) });
                    events.push({ type: 1, s: s, pos: Math.max(s[0][y], s[1][y]) });
                }
                events.sort((a, b) => a.pos - b.pos + a.type - b.type);
                var open = [];
                var openCount = 0;
                events.forEach(e => {
                    if (e.type === 0) {
                        open.push(e.s);
                        openCount++;
                    }
                    else {
                        openCount--;
                    }
                    if (openCount == 0) {
                        GridRouter.nudgeSegs(x, y, routes, open, leftOf, gap);
                        open = [];
                    }
                });
            }
        }
        // obtain routes for the specified edges, nicely nudged apart
        // warning: edge paths may be reversed such that common paths are ordered consistently within bundles!
        // @param edges list of edges
        // @param nudgeGap how much to space parallel edge segements
        // @param source function to retrieve the index of the source node for a given edge
        // @param target function to retrieve the index of the target node for a given edge
        // @returns an array giving, for each edge, an array of segments, each segment a pair of points in an array
        routeEdges(edges, nudgeGap, source, target) {
            var routePaths = edges.map(e => this.route(source(e), target(e)));
            var order = GridRouter.orderEdges(routePaths);
            var routes = routePaths.map(function (e) { return GridRouter.makeSegments(e); });
            GridRouter.nudgeSegments(routes, 'x', 'y', order, nudgeGap);
            GridRouter.nudgeSegments(routes, 'y', 'x', order, nudgeGap);
            GridRouter.unreverseEdges(routes, routePaths);
            return routes;
        }
        // path may have been reversed by the subsequence processing in orderEdges
        // so now we need to restore the original order
        static unreverseEdges(routes, routePaths) {
            routes.forEach((segments, i) => {
                var path = routePaths[i];
                if (path.reversed) {
                    segments.reverse(); // reverse order of segments
                    segments.forEach(function (segment) {
                        segment.reverse(); // reverse each segment
                    });
                }
            });
        }
        static angleBetween2Lines(line1, line2) {
            var angle1 = Math.atan2(line1[0].y - line1[1].y, line1[0].x - line1[1].x);
            var angle2 = Math.atan2(line2[0].y - line2[1].y, line2[0].x - line2[1].x);
            var diff = angle1 - angle2;
            if (diff > Math.PI || diff < -Math.PI) {
                diff = angle2 - angle1;
            }
            return diff;
        }
        // does the path a-b-c describe a left turn?
        static isLeft(a, b, c) {
            return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) <= 0;
        }
        // for the given list of ordered pairs, returns a function that (efficiently) looks-up a specific pair to
        // see if it exists in the list
        static getOrder(pairs) {
            var outgoing = {};
            for (var i = 0; i < pairs.length; i++) {
                var p = pairs[i];
                if (typeof outgoing[p.l] === 'undefined')
                    outgoing[p.l] = {};
                outgoing[p.l][p.r] = true;
            }
            return (l, r) => typeof outgoing[l] !== 'undefined' && outgoing[l][r];
        }
        // returns an ordering (a lookup function) that determines the correct order to nudge the
        // edge paths apart to minimize crossings
        static orderEdges(edges) {
            var edgeOrder = [];
            for (var i = 0; i < edges.length - 1; i++) {
                for (var j = i + 1; j < edges.length; j++) {
                    var e = edges[i], f = edges[j], lcs = new LongestCommonSubsequence(e, f);
                    var u, vi, vj;
                    if (lcs.length === 0)
                        continue; // no common subpath
                    if (lcs.reversed) {
                        // if we found a common subpath but one of the edges runs the wrong way,
                        // then reverse f.
                        f.reverse();
                        f.reversed = true;
                        lcs = new LongestCommonSubsequence(e, f);
                    }
                    if ((lcs.si <= 0 || lcs.ti <= 0) &&
                        (lcs.si + lcs.length >= e.length || lcs.ti + lcs.length >= f.length)) {
                        // the paths do not diverge, so make an arbitrary ordering decision
                        edgeOrder.push({ l: i, r: j });
                        continue;
                    }
                    if (lcs.si + lcs.length >= e.length || lcs.ti + lcs.length >= f.length) {
                        // if the common subsequence of the
                        // two edges being considered goes all the way to the
                        // end of one (or both) of the lines then we have to
                        // base our ordering decision on the other end of the
                        // common subsequence
                        u = e[lcs.si + 1];
                        vj = e[lcs.si - 1];
                        vi = f[lcs.ti - 1];
                    }
                    else {
                        u = e[lcs.si + lcs.length - 2];
                        vi = e[lcs.si + lcs.length];
                        vj = f[lcs.ti + lcs.length];
                    }
                    if (GridRouter.isLeft(u, vi, vj)) {
                        edgeOrder.push({ l: j, r: i });
                    }
                    else {
                        edgeOrder.push({ l: i, r: j });
                    }
                }
            }
            //edgeOrder.forEach(function (e) { console.log('l:' + e.l + ',r:' + e.r) });
            return GridRouter.getOrder(edgeOrder);
        }
        // for an orthogonal path described by a sequence of points, create a list of segments
        // if consecutive segments would make a straight line they are merged into a single segment
        // segments are over cloned points, not the original vertices
        static makeSegments(path) {
            function copyPoint(p) {
                return { x: p.x, y: p.y };
            }
            var isStraight = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 0.001;
            var segments = [];
            var a = copyPoint(path[0]);
            for (var i = 1; i < path.length; i++) {
                var b = copyPoint(path[i]), c = i < path.length - 1 ? path[i + 1] : null;
                if (!c || !isStraight(a, b, c)) {
                    segments.push([a, b]);
                    a = b;
                }
            }
            return segments;
        }
        // find a route between node s and node t
        // returns an array of indices to verts
        route(s, t) {
            var source = this.nodes[s], target = this.nodes[t];
            this.obstacles = this.siblingObstacles(source, target);
            var obstacleLookup = {};
            this.obstacles.forEach(o => obstacleLookup[o.id] = o);
            this.passableEdges = this.edges.filter(e => {
                var u = this.verts[e.source], v = this.verts[e.target];
                return !(u.node && u.node.id in obstacleLookup
                    || v.node && v.node.id in obstacleLookup);
            });
            // add dummy segments linking ports inside source and target
            for (var i = 1; i < source.ports.length; i++) {
                var u = source.ports[0].id;
                var v = source.ports[i].id;
                this.passableEdges.push({
                    source: u,
                    target: v,
                    length: 0
                });
            }
            for (var i = 1; i < target.ports.length; i++) {
                var u = target.ports[0].id;
                var v = target.ports[i].id;
                this.passableEdges.push({
                    source: u,
                    target: v,
                    length: 0
                });
            }
            var getSource = e => e.source, getTarget = e => e.target, getLength = e => e.length;
            var shortestPathCalculator = new shortestpaths_1.Calculator(this.verts.length, this.passableEdges, getSource, getTarget, getLength);
            var bendPenalty = (u, v, w) => {
                var a = this.verts[u], b = this.verts[v], c = this.verts[w];
                var dx = Math.abs(c.x - a.x), dy = Math.abs(c.y - a.y);
                // don't count bends from internal node edges
                if (a.node === source && a.node === b.node || b.node === target && b.node === c.node)
                    return 0;
                return dx > 1 && dy > 1 ? 1000 : 0;
            };
            // get shortest path
            var shortestPath = shortestPathCalculator.PathFromNodeToNodeWithPrevCost(source.ports[0].id, target.ports[0].id, bendPenalty);
            // shortest path is reversed and does not include the target port
            var pathPoints = shortestPath.reverse().map(vi => this.verts[vi]);
            pathPoints.push(this.nodes[target.id].ports[0]);
            // filter out any extra end points that are inside the source or target (i.e. the dummy segments above)
            return pathPoints.filter((v, i) => !(i < pathPoints.length - 1 && pathPoints[i + 1].node === source && v.node === source
                || i > 0 && v.node === target && pathPoints[i - 1].node === target));
        }
        static getRoutePath(route, cornerradius, arrowwidth, arrowheight) {
            var result = {
                routepath: 'M ' + route[0][0].x + ' ' + route[0][0].y + ' ',
                arrowpath: ''
            };
            if (route.length > 1) {
                for (var i = 0; i < route.length; i++) {
                    var li = route[i];
                    var x = li[1].x, y = li[1].y;
                    var dx = x - li[0].x;
                    var dy = y - li[0].y;
                    if (i < route.length - 1) {
                        if (Math.abs(dx) > 0) {
                            x -= dx / Math.abs(dx) * cornerradius;
                        }
                        else {
                            y -= dy / Math.abs(dy) * cornerradius;
                        }
                        result.routepath += 'L ' + x + ' ' + y + ' ';
                        var l = route[i + 1];
                        var x0 = l[0].x, y0 = l[0].y;
                        var x1 = l[1].x;
                        var y1 = l[1].y;
                        dx = x1 - x0;
                        dy = y1 - y0;
                        var angle = GridRouter.angleBetween2Lines(li, l) < 0 ? 1 : 0;
                        //console.log(cola.GridRouter.angleBetween2Lines(li, l))
                        var x2, y2;
                        if (Math.abs(dx) > 0) {
                            x2 = x0 + dx / Math.abs(dx) * cornerradius;
                            y2 = y0;
                        }
                        else {
                            x2 = x0;
                            y2 = y0 + dy / Math.abs(dy) * cornerradius;
                        }
                        var cx = Math.abs(x2 - x);
                        var cy = Math.abs(y2 - y);
                        result.routepath += 'A ' + cx + ' ' + cy + ' 0 0 ' + angle + ' ' + x2 + ' ' + y2 + ' ';
                    }
                    else {
                        var arrowtip = [x, y];
                        var arrowcorner1, arrowcorner2;
                        if (Math.abs(dx) > 0) {
                            x -= dx / Math.abs(dx) * arrowheight;
                            arrowcorner1 = [x, y + arrowwidth];
                            arrowcorner2 = [x, y - arrowwidth];
                        }
                        else {
                            y -= dy / Math.abs(dy) * arrowheight;
                            arrowcorner1 = [x + arrowwidth, y];
                            arrowcorner2 = [x - arrowwidth, y];
                        }
                        result.routepath += 'L ' + x + ' ' + y + ' ';
                        if (arrowheight > 0) {
                            result.arrowpath = 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                                + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1];
                        }
                    }
                }
            }
            else {
                var li = route[0];
                var x = li[1].x, y = li[1].y;
                var dx = x - li[0].x;
                var dy = y - li[0].y;
                var arrowtip = [x, y];
                var arrowcorner1, arrowcorner2;
                if (Math.abs(dx) > 0) {
                    x -= dx / Math.abs(dx) * arrowheight;
                    arrowcorner1 = [x, y + arrowwidth];
                    arrowcorner2 = [x, y - arrowwidth];
                }
                else {
                    y -= dy / Math.abs(dy) * arrowheight;
                    arrowcorner1 = [x + arrowwidth, y];
                    arrowcorner2 = [x - arrowwidth, y];
                }
                result.routepath += 'L ' + x + ' ' + y + ' ';
                if (arrowheight > 0) {
                    result.arrowpath = 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                        + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1];
                }
            }
            return result;
        }
    }
    exports.GridRouter = GridRouter;
    },{"./rectangle":18,"./shortestpaths":19,"./vpsc":20}],11:[function(require,module,exports){
    "use strict";
    var packingOptions = {
        PADDING: 10,
        GOLDEN_SECTION: (1 + Math.sqrt(5)) / 2,
        FLOAT_EPSILON: 0.0001,
        MAX_INERATIONS: 100
    };
    // assign x, y to nodes while using box packing algorithm for disconnected graphs
    function applyPacking(graphs, w, h, node_size, desired_ratio = 1) {
        var init_x = 0, init_y = 0, svg_width = w, svg_height = h, desired_ratio = typeof desired_ratio !== 'undefined' ? desired_ratio : 1, node_size = typeof node_size !== 'undefined' ? node_size : 0, real_width = 0, real_height = 0, min_width = 0, global_bottom = 0, line = [];
        if (graphs.length == 0)
            return;
        /// that would take care of single nodes problem
        // graphs.forEach(function (g) {
        //     if (g.array.length == 1) {
        //         g.array[0].x = 0;
        //         g.array[0].y = 0;
        //     }
        // });
        calculate_bb(graphs);
        apply(graphs, desired_ratio);
        put_nodes_to_right_positions(graphs);
        // get bounding boxes for all separate graphs
        function calculate_bb(graphs) {
            graphs.forEach(function (g) {
                calculate_single_bb(g);
            });
            function calculate_single_bb(graph) {
                var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE, max_x = 0, max_y = 0;
                graph.array.forEach(function (v) {
                    var w = typeof v.width !== 'undefined' ? v.width : node_size;
                    var h = typeof v.height !== 'undefined' ? v.height : node_size;
                    w /= 2;
                    h /= 2;
                    max_x = Math.max(v.x + w, max_x);
                    min_x = Math.min(v.x - w, min_x);
                    max_y = Math.max(v.y + h, max_y);
                    min_y = Math.min(v.y - h, min_y);
                });
                graph.width = max_x - min_x;
                graph.height = max_y - min_y;
            }
        }
        //function plot(data, left, right, opt_x, opt_y) {
        //    // plot the cost function
        //    var plot_svg = d3.select("body").append("svg")
        //        .attr("width", function () { return 2 * (right - left); })
        //        .attr("height", 200);
        //    var x = d3.time.scale().range([0, 2 * (right - left)]);
        //    var xAxis = d3.svg.axis().scale(x).orient("bottom");
        //    plot_svg.append("g").attr("class", "x axis")
        //        .attr("transform", "translate(0, 199)")
        //        .call(xAxis);
        //    var lastX = 0;
        //    var lastY = 0;
        //    var value = 0;
        //    for (var r = left; r < right; r += 1) {
        //        value = step(data, r);
        //        // value = 1;
        //        plot_svg.append("line").attr("x1", 2 * (lastX - left))
        //            .attr("y1", 200 - 30 * lastY)
        //            .attr("x2", 2 * r - 2 * left)
        //            .attr("y2", 200 - 30 * value)
        //            .style("stroke", "rgb(6,120,155)");
        //        lastX = r;
        //        lastY = value;
        //    }
        //    plot_svg.append("circle").attr("cx", 2 * opt_x - 2 * left).attr("cy", 200 - 30 * opt_y)
        //        .attr("r", 5).style('fill', "rgba(0,0,0,0.5)");
        //}
        // actual assigning of position to nodes
        function put_nodes_to_right_positions(graphs) {
            graphs.forEach(function (g) {
                // calculate current graph center:
                var center = { x: 0, y: 0 };
                g.array.forEach(function (node) {
                    center.x += node.x;
                    center.y += node.y;
                });
                center.x /= g.array.length;
                center.y /= g.array.length;
                // calculate current top left corner:
                var corner = { x: center.x - g.width / 2, y: center.y - g.height / 2 };
                var offset = { x: g.x - corner.x + svg_width / 2 - real_width / 2, y: g.y - corner.y + svg_height / 2 - real_height / 2 };
                // put nodes:
                g.array.forEach(function (node) {
                    node.x += offset.x;
                    node.y += offset.y;
                });
            });
        }
        // starts box packing algorithm
        // desired ratio is 1 by default
        function apply(data, desired_ratio) {
            var curr_best_f = Number.POSITIVE_INFINITY;
            var curr_best = 0;
            data.sort(function (a, b) { return b.height - a.height; });
            min_width = data.reduce(function (a, b) {
                return a.width < b.width ? a.width : b.width;
            });
            var left = x1 = min_width;
            var right = x2 = get_entire_width(data);
            var iterationCounter = 0;
            var f_x1 = Number.MAX_VALUE;
            var f_x2 = Number.MAX_VALUE;
            var flag = -1; // determines which among f_x1 and f_x2 to recompute
            var dx = Number.MAX_VALUE;
            var df = Number.MAX_VALUE;
            while ((dx > min_width) || df > packingOptions.FLOAT_EPSILON) {
                if (flag != 1) {
                    var x1 = right - (right - left) / packingOptions.GOLDEN_SECTION;
                    var f_x1 = step(data, x1);
                }
                if (flag != 0) {
                    var x2 = left + (right - left) / packingOptions.GOLDEN_SECTION;
                    var f_x2 = step(data, x2);
                }
                dx = Math.abs(x1 - x2);
                df = Math.abs(f_x1 - f_x2);
                if (f_x1 < curr_best_f) {
                    curr_best_f = f_x1;
                    curr_best = x1;
                }
                if (f_x2 < curr_best_f) {
                    curr_best_f = f_x2;
                    curr_best = x2;
                }
                if (f_x1 > f_x2) {
                    left = x1;
                    x1 = x2;
                    f_x1 = f_x2;
                    flag = 1;
                }
                else {
                    right = x2;
                    x2 = x1;
                    f_x2 = f_x1;
                    flag = 0;
                }
                if (iterationCounter++ > 100) {
                    break;
                }
            }
            // plot(data, min_width, get_entire_width(data), curr_best, curr_best_f);
            step(data, curr_best);
        }
        // one iteration of the optimization method
        // (gives a proper, but not necessarily optimal packing)
        function step(data, max_width) {
            line = [];
            real_width = 0;
            real_height = 0;
            global_bottom = init_y;
            for (var i = 0; i < data.length; i++) {
                var o = data[i];
                put_rect(o, max_width);
            }
            return Math.abs(get_real_ratio() - desired_ratio);
        }
        // looking for a position to one box
        function put_rect(rect, max_width) {
            var parent = undefined;
            for (var i = 0; i < line.length; i++) {
                if ((line[i].space_left >= rect.height) && (line[i].x + line[i].width + rect.width + packingOptions.PADDING - max_width) <= packingOptions.FLOAT_EPSILON) {
                    parent = line[i];
                    break;
                }
            }
            line.push(rect);
            if (parent !== undefined) {
                rect.x = parent.x + parent.width + packingOptions.PADDING;
                rect.y = parent.bottom;
                rect.space_left = rect.height;
                rect.bottom = rect.y;
                parent.space_left -= rect.height + packingOptions.PADDING;
                parent.bottom += rect.height + packingOptions.PADDING;
            }
            else {
                rect.y = global_bottom;
                global_bottom += rect.height + packingOptions.PADDING;
                rect.x = init_x;
                rect.bottom = rect.y;
                rect.space_left = rect.height;
            }
            if (rect.y + rect.height - real_height > -packingOptions.FLOAT_EPSILON)
                real_height = rect.y + rect.height - init_y;
            if (rect.x + rect.width - real_width > -packingOptions.FLOAT_EPSILON)
                real_width = rect.x + rect.width - init_x;
        }
        ;
        function get_entire_width(data) {
            var width = 0;
            data.forEach(function (d) { return width += d.width + packingOptions.PADDING; });
            return width;
        }
        function get_real_ratio() {
            return (real_width / real_height);
        }
    }
    exports.applyPacking = applyPacking;
    /**
     * connected components of graph
     * returns an array of {}
     */
    function separateGraphs(nodes, links) {
        var marks = {};
        var ways = {};
        var graphs = [];
        var clusters = 0;
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var n1 = link.source;
            var n2 = link.target;
            if (ways[n1.index])
                ways[n1.index].push(n2);
            else
                ways[n1.index] = [n2];
            if (ways[n2.index])
                ways[n2.index].push(n1);
            else
                ways[n2.index] = [n1];
        }
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (marks[node.index])
                continue;
            explore_node(node, true);
        }
        function explore_node(n, is_new) {
            if (marks[n.index] !== undefined)
                return;
            if (is_new) {
                clusters++;
                graphs.push({ array: [] });
            }
            marks[n.index] = clusters;
            graphs[clusters - 1].array.push(n);
            var adjacent = ways[n.index];
            if (!adjacent)
                return;
            for (var j = 0; j < adjacent.length; j++) {
                explore_node(adjacent[j], false);
            }
        }
        return graphs;
    }
    exports.separateGraphs = separateGraphs;
    },{}],12:[function(require,module,exports){
    "use strict";
    const powergraph = require("./powergraph");
    const linklengths_1 = require("./linklengths");
    const descent_1 = require("./descent");
    const rectangle_1 = require("./rectangle");
    const shortestpaths_1 = require("./shortestpaths");
    const geom_1 = require("./geom");
    const handledisconnected_1 = require("./handledisconnected");
    /**
     * The layout process fires three events:
     *  - start: layout iterations started
     *  - tick: fired once per iteration, listen to this to animate
     *  - end: layout converged, you might like to zoom-to-fit or something at notification of this event
     */
    var EventType;
    (function (EventType) {
        EventType[EventType["start"] = 0] = "start";
        EventType[EventType["tick"] = 1] = "tick";
        EventType[EventType["end"] = 2] = "end";
    })(EventType = exports.EventType || (exports.EventType = {}));
    ;
    function isGroup(g) {
        return typeof g.leaves !== 'undefined' || typeof g.groups !== 'undefined';
    }
    /**
     * Main interface to cola layout.
     * @class Layout
     */
    class Layout {
        constructor() {
            this._canvasSize = [1, 1];
            this._linkDistance = 20;
            this._defaultNodeSize = 10;
            this._linkLengthCalculator = null;
            this._linkType = null;
            this._avoidOverlaps = false;
            this._handleDisconnected = true;
            this._running = false;
            this._nodes = [];
            this._groups = [];
            this._rootGroup = null;
            this._links = [];
            this._constraints = [];
            this._distanceMatrix = null;
            this._descent = null;
            this._directedLinkConstraints = null;
            this._threshold = 0.01;
            this._visibilityGraph = null;
            this._groupCompactness = 1e-6;
            // sub-class and override this property to replace with a more sophisticated eventing mechanism
            this.event = null;
            this.linkAccessor = {
                getSourceIndex: Layout.getSourceIndex,
                getTargetIndex: Layout.getTargetIndex,
                setLength: Layout.setLinkLength,
                getType: l => typeof this._linkType === "function" ? this._linkType(l) : 0
            };
        }
        // subscribe a listener to an event
        // sub-class and override this method to replace with a more sophisticated eventing mechanism
        on(e, listener) {
            // override me!
            if (!this.event)
                this.event = {};
            if (typeof e === 'string') {
                this.event[EventType[e]] = listener;
            }
            else {
                this.event[e] = listener;
            }
            return this;
        }
        // a function that is notified of events like "tick"
        // sub-classes can override this method to replace with a more sophisticated eventing mechanism
        trigger(e) {
            if (this.event && typeof this.event[e.type] !== 'undefined') {
                this.event[e.type](e);
            }
        }
        // a function that kicks off the iteration tick loop
        // it calls tick() repeatedly until tick returns true (is converged)
        // subclass and override it with something fancier (e.g. dispatch tick on a timer)
        kick() {
            while (!this.tick())
                ;
        }
        /**
         * iterate the layout.  Returns true when layout converged.
         */
        tick() {
            if (this._alpha < this._threshold) {
                this._running = false;
                this.trigger({ type: EventType.end, alpha: this._alpha = 0, stress: this._lastStress });
                return true;
            }
            const n = this._nodes.length, m = this._links.length;
            let o, i;
            this._descent.locks.clear();
            for (i = 0; i < n; ++i) {
                o = this._nodes[i];
                if (o.fixed) {
                    if (typeof o.px === 'undefined' || typeof o.py === 'undefined') {
                        o.px = o.x;
                        o.py = o.y;
                    }
                    var p = [o.px, o.py];
                    this._descent.locks.add(i, p);
                }
            }
            let s1 = this._descent.rungeKutta();
            //var s1 = descent.reduceStress();
            if (s1 === 0) {
                this._alpha = 0;
            }
            else if (typeof this._lastStress !== 'undefined') {
                this._alpha = s1; //Math.abs(Math.abs(this._lastStress / s1) - 1);
            }
            this._lastStress = s1;
            this.updateNodePositions();
            this.trigger({ type: EventType.tick, alpha: this._alpha, stress: this._lastStress });
            return false;
        }
        // copy positions out of descent instance into each of the nodes' center coords
        updateNodePositions() {
            const x = this._descent.x[0], y = this._descent.x[1];
            let o, i = this._nodes.length;
            while (i--) {
                o = this._nodes[i];
                o.x = x[i];
                o.y = y[i];
            }
        }
        nodes(v) {
            if (!v) {
                if (this._nodes.length === 0 && this._links.length > 0) {
                    // if we have links but no nodes, create the nodes array now with empty objects for the links to point at.
                    // in this case the links are expected to be numeric indices for nodes in the range 0..n-1 where n is the number of nodes
                    var n = 0;
                    this._links.forEach(function (l) {
                        n = Math.max(n, l.source, l.target);
                    });
                    this._nodes = new Array(++n);
                    for (var i = 0; i < n; ++i) {
                        this._nodes[i] = {};
                    }
                }
                return this._nodes;
            }
            this._nodes = v;
            return this;
        }
        groups(x) {
            if (!x)
                return this._groups;
            this._groups = x;
            this._rootGroup = {};
            this._groups.forEach(g => {
                if (typeof g.padding === "undefined")
                    g.padding = 1;
                if (typeof g.leaves !== "undefined") {
                    g.leaves.forEach((v, i) => {
                        if (typeof v === 'number')
                            (g.leaves[i] = this._nodes[v]).parent = g;
                    });
                }
                if (typeof g.groups !== "undefined") {
                    g.groups.forEach((gi, i) => {
                        if (typeof gi === 'number')
                            (g.groups[i] = this._groups[gi]).parent = g;
                    });
                }
            });
            this._rootGroup.leaves = this._nodes.filter(v => typeof v.parent === 'undefined');
            this._rootGroup.groups = this._groups.filter(g => typeof g.parent === 'undefined');
            return this;
        }
        powerGraphGroups(f) {
            var g = powergraph.getGroups(this._nodes, this._links, this.linkAccessor, this._rootGroup);
            this.groups(g.groups);
            f(g);
            return this;
        }
        avoidOverlaps(v) {
            if (!arguments.length)
                return this._avoidOverlaps;
            this._avoidOverlaps = v;
            return this;
        }
        handleDisconnected(v) {
            if (!arguments.length)
                return this._handleDisconnected;
            this._handleDisconnected = v;
            return this;
        }
        /**
         * causes constraints to be generated such that directed graphs are laid out either from left-to-right or top-to-bottom.
         * a separation constraint is generated in the selected axis for each edge that is not involved in a cycle (part of a strongly connected component)
         * @param axis {string} 'x' for left-to-right, 'y' for top-to-bottom
         * @param minSeparation {number|link=>number} either a number specifying a minimum spacing required across all links or a function to return the minimum spacing for each link
         */
        flowLayout(axis, minSeparation) {
            if (!arguments.length)
                axis = 'y';
            this._directedLinkConstraints = {
                axis: axis,
                getMinSeparation: typeof minSeparation === 'number' ? function () { return minSeparation; } : minSeparation
            };
            return this;
        }
        links(x) {
            if (!arguments.length)
                return this._links;
            this._links = x;
            return this;
        }
        constraints(c) {
            if (!arguments.length)
                return this._constraints;
            this._constraints = c;
            return this;
        }
        distanceMatrix(d) {
            if (!arguments.length)
                return this._distanceMatrix;
            this._distanceMatrix = d;
            return this;
        }
        size(x) {
            if (!x)
                return this._canvasSize;
            this._canvasSize = x;
            return this;
        }
        defaultNodeSize(x) {
            if (!x)
                return this._defaultNodeSize;
            this._defaultNodeSize = x;
            return this;
        }
        groupCompactness(x) {
            if (!x)
                return this._groupCompactness;
            this._groupCompactness = x;
            return this;
        }
        linkDistance(x) {
            if (!x) {
                return this._linkDistance;
            }
            this._linkDistance = typeof x === "function" ? x : +x;
            this._linkLengthCalculator = null;
            return this;
        }
        linkType(f) {
            this._linkType = f;
            return this;
        }
        convergenceThreshold(x) {
            if (!x)
                return this._threshold;
            this._threshold = typeof x === "function" ? x : +x;
            return this;
        }
        alpha(x) {
            if (!arguments.length)
                return this._alpha;
            else {
                x = +x;
                if (this._alpha) {
                    if (x > 0)
                        this._alpha = x; // we might keep it hot
                    else
                        this._alpha = 0; // or, next tick will dispatch "end"
                }
                else if (x > 0) {
                    if (!this._running) {
                        this._running = true;
                        this.trigger({ type: EventType.start, alpha: this._alpha = x });
                        this.kick();
                    }
                }
                return this;
            }
        }
        getLinkLength(link) {
            return typeof this._linkDistance === "function" ? +(this._linkDistance(link)) : this._linkDistance;
        }
        static setLinkLength(link, length) {
            link.length = length;
        }
        getLinkType(link) {
            return typeof this._linkType === "function" ? this._linkType(link) : 0;
        }
        /**
         * compute an ideal length for each link based on the graph structure around that link.
         * you can use this (for example) to create extra space around hub-nodes in dense graphs.
         * In particular this calculation is based on the "symmetric difference" in the neighbour sets of the source and target:
         * i.e. if neighbours of source is a and neighbours of target are b then calculation is: sqrt(|a union b| - |a intersection b|)
         * Actual computation based on inspection of link structure occurs in start(), so links themselves
         * don't have to have been assigned before invoking this function.
         * @param {number} [idealLength] the base length for an edge when its source and start have no other common neighbours (e.g. 40)
         * @param {number} [w] a multiplier for the effect of the length adjustment (e.g. 0.7)
         */
        symmetricDiffLinkLengths(idealLength, w = 1) {
            this.linkDistance(l => idealLength * l.length);
            this._linkLengthCalculator = () => linklengths_1.symmetricDiffLinkLengths(this._links, this.linkAccessor, w);
            return this;
        }
        /**
         * compute an ideal length for each link based on the graph structure around that link.
         * you can use this (for example) to create extra space around hub-nodes in dense graphs.
         * In particular this calculation is based on the "symmetric difference" in the neighbour sets of the source and target:
         * i.e. if neighbours of source is a and neighbours of target are b then calculation is: |a intersection b|/|a union b|
         * Actual computation based on inspection of link structure occurs in start(), so links themselves
         * don't have to have been assigned before invoking this function.
         * @param {number} [idealLength] the base length for an edge when its source and start have no other common neighbours (e.g. 40)
         * @param {number} [w] a multiplier for the effect of the length adjustment (e.g. 0.7)
         */
        jaccardLinkLengths(idealLength, w = 1) {
            this.linkDistance(l => idealLength * l.length);
            this._linkLengthCalculator = () => linklengths_1.jaccardLinkLengths(this._links, this.linkAccessor, w);
            return this;
        }
        /**
         * start the layout process
         * @method start
         * @param {number} [initialUnconstrainedIterations=0] unconstrained initial layout iterations
         * @param {number} [initialUserConstraintIterations=0] initial layout iterations with user-specified constraints
         * @param {number} [initialAllConstraintsIterations=0] initial layout iterations with all constraints including non-overlap
         * @param {number} [gridSnapIterations=0] iterations of "grid snap", which pulls nodes towards grid cell centers - grid of size node[0].width - only really makes sense if all nodes have the same width and height
         * @param [keepRunning=true] keep iterating asynchronously via the tick method
         */
        start(initialUnconstrainedIterations = 0, initialUserConstraintIterations = 0, initialAllConstraintsIterations = 0, gridSnapIterations = 0, keepRunning = true) {
            var i, j, n = this.nodes().length, N = n + 2 * this._groups.length, m = this._links.length, w = this._canvasSize[0], h = this._canvasSize[1];
            var x = new Array(N), y = new Array(N);
            var G = null;
            var ao = this._avoidOverlaps;
            this._nodes.forEach((v, i) => {
                v.index = i;
                if (typeof v.x === 'undefined') {
                    v.x = w / 2, v.y = h / 2;
                }
                x[i] = v.x, y[i] = v.y;
            });
            if (this._linkLengthCalculator)
                this._linkLengthCalculator();
            //should we do this to clearly label groups?
            //this._groups.forEach((g, i) => g.groupIndex = i);
            var distances;
            if (this._distanceMatrix) {
                // use the user specified distanceMatrix
                distances = this._distanceMatrix;
            }
            else {
                // construct an n X n distance matrix based on shortest paths through graph (with respect to edge.length).
                distances = (new shortestpaths_1.Calculator(N, this._links, Layout.getSourceIndex, Layout.getTargetIndex, l => this.getLinkLength(l))).DistanceMatrix();
                // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
                // otherwise 2. (
                G = descent_1.Descent.createSquareMatrix(N, () => 2);
                this._links.forEach(l => {
                    if (typeof l.source == "number")
                        l.source = this._nodes[l.source];
                    if (typeof l.target == "number")
                        l.target = this._nodes[l.target];
                });
                this._links.forEach(e => {
                    const u = Layout.getSourceIndex(e), v = Layout.getTargetIndex(e);
                    G[u][v] = G[v][u] = e.weight || 1;
                });
            }
            var D = descent_1.Descent.createSquareMatrix(N, function (i, j) {
                return distances[i][j];
            });
            if (this._rootGroup && typeof this._rootGroup.groups !== 'undefined') {
                var i = n;
                var addAttraction = (i, j, strength, idealDistance) => {
                    G[i][j] = G[j][i] = strength;
                    D[i][j] = D[j][i] = idealDistance;
                };
                this._groups.forEach(g => {
                    addAttraction(i, i + 1, this._groupCompactness, 0.1);
                    // todo: add terms here attracting children of the group to the group dummy nodes
                    //if (typeof g.leaves !== 'undefined')
                    //    g.leaves.forEach(l => {
                    //        addAttraction(l.index, i, 1e-4, 0.1);
                    //        addAttraction(l.index, i + 1, 1e-4, 0.1);
                    //    });
                    //if (typeof g.groups !== 'undefined')
                    //    g.groups.forEach(g => {
                    //        var gid = n + g.groupIndex * 2;
                    //        addAttraction(gid, i, 0.1, 0.1);
                    //        addAttraction(gid + 1, i, 0.1, 0.1);
                    //        addAttraction(gid, i + 1, 0.1, 0.1);
                    //        addAttraction(gid + 1, i + 1, 0.1, 0.1);
                    //    });
                    x[i] = 0, y[i++] = 0;
                    x[i] = 0, y[i++] = 0;
                });
            }
            else
                this._rootGroup = { leaves: this._nodes, groups: [] };
            var curConstraints = this._constraints || [];
            if (this._directedLinkConstraints) {
                this.linkAccessor.getMinSeparation = this._directedLinkConstraints.getMinSeparation;
                curConstraints = curConstraints.concat(linklengths_1.generateDirectedEdgeConstraints(n, this._links, this._directedLinkConstraints.axis, (this.linkAccessor)));
            }
            this.avoidOverlaps(false);
            this._descent = new descent_1.Descent([x, y], D);
            this._descent.locks.clear();
            for (var i = 0; i < n; ++i) {
                var o = this._nodes[i];
                if (o.fixed) {
                    o.px = o.x;
                    o.py = o.y;
                    var p = [o.x, o.y];
                    this._descent.locks.add(i, p);
                }
            }
            this._descent.threshold = this._threshold;
            // apply initialIterations without user constraints or nonoverlap constraints
            // if groups are specified, dummy nodes and edges will be added to untangle
            // with respect to group connectivity
            this.initialLayout(initialUnconstrainedIterations, x, y);
            // apply initialIterations with user constraints but no nonoverlap constraints
            if (curConstraints.length > 0)
                this._descent.project = new rectangle_1.Projection(this._nodes, this._groups, this._rootGroup, curConstraints).projectFunctions();
            this._descent.run(initialUserConstraintIterations);
            this.separateOverlappingComponents(w, h);
            // subsequent iterations will apply all constraints
            this.avoidOverlaps(ao);
            if (ao) {
                this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
                this._descent.project = new rectangle_1.Projection(this._nodes, this._groups, this._rootGroup, curConstraints, true).projectFunctions();
                this._nodes.forEach(function (v, i) { x[i] = v.x, y[i] = v.y; });
            }
            // allow not immediately connected nodes to relax apart (p-stress)
            this._descent.G = G;
            this._descent.run(initialAllConstraintsIterations);
            if (gridSnapIterations) {
                this._descent.snapStrength = 1000;
                this._descent.snapGridSize = this._nodes[0].width;
                this._descent.numGridSnapNodes = n;
                this._descent.scaleSnapByMaxH = n != N; // if we have groups then need to scale hessian so grid forces still apply
                var G0 = descent_1.Descent.createSquareMatrix(N, (i, j) => {
                    if (i >= n || j >= n)
                        return G[i][j];
                    return 0;
                });
                this._descent.G = G0;
                this._descent.run(gridSnapIterations);
            }
            this.updateNodePositions();
            this.separateOverlappingComponents(w, h);
            return keepRunning ? this.resume() : this;
        }
        initialLayout(iterations, x, y) {
            if (this._groups.length > 0 && iterations > 0) {
                // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
                // todo: edges attached to groups are replaced with edges connected to the corresponding group dummy node
                var n = this._nodes.length;
                var edges = this._links.map(e => ({ source: e.source.index, target: e.target.index }));
                var vs = this._nodes.map(v => ({ index: v.index }));
                this._groups.forEach((g, i) => {
                    vs.push({ index: g.index = n + i });
                });
                this._groups.forEach((g, i) => {
                    if (typeof g.leaves !== 'undefined')
                        g.leaves.forEach(v => edges.push({ source: g.index, target: v.index }));
                    if (typeof g.groups !== 'undefined')
                        g.groups.forEach(gg => edges.push({ source: g.index, target: gg.index }));
                });
                // layout the flat graph with dummy nodes and edges
                new Layout()
                    .size(this.size())
                    .nodes(vs)
                    .links(edges)
                    .avoidOverlaps(false)
                    .linkDistance(this.linkDistance())
                    .symmetricDiffLinkLengths(5)
                    .convergenceThreshold(1e-4)
                    .start(iterations, 0, 0, 0, false);
                this._nodes.forEach(v => {
                    x[v.index] = vs[v.index].x;
                    y[v.index] = vs[v.index].y;
                });
            }
            else {
                this._descent.run(iterations);
            }
        }
        // recalculate nodes position for disconnected graphs
        separateOverlappingComponents(width, height) {
            // recalculate nodes position for disconnected graphs
            if (!this._distanceMatrix && this._handleDisconnected) {
                let x = this._descent.x[0], y = this._descent.x[1];
                this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
                var graphs = handledisconnected_1.separateGraphs(this._nodes, this._links);
                handledisconnected_1.applyPacking(graphs, width, height, this._defaultNodeSize);
                this._nodes.forEach((v, i) => {
                    this._descent.x[0][i] = v.x, this._descent.x[1][i] = v.y;
                    if (v.bounds) {
                        v.bounds.setXCentre(v.x);
                        v.bounds.setYCentre(v.y);
                    }
                });
            }
        }
        resume() {
            return this.alpha(0.1);
        }
        stop() {
            return this.alpha(0);
        }
        /// find a visibility graph over the set of nodes.  assumes all nodes have a
        /// bounds property (a rectangle) and that no pair of bounds overlaps.
        prepareEdgeRouting(nodeMargin = 0) {
            this._visibilityGraph = new geom_1.TangentVisibilityGraph(this._nodes.map(function (v) {
                return v.bounds.inflate(-nodeMargin).vertices();
            }));
        }
        /// find a route avoiding node bounds for the given edge.
        /// assumes the visibility graph has been created (by prepareEdgeRouting method)
        /// and also assumes that nodes have an index property giving their position in the
        /// node array.  This index property is created by the start() method.
        routeEdge(edge, draw) {
            var lineData = [];
            //if (d.source.id === 10 && d.target.id === 11) {
            //    debugger;
            //}
            var vg2 = new geom_1.TangentVisibilityGraph(this._visibilityGraph.P, { V: this._visibilityGraph.V, E: this._visibilityGraph.E }), port1 = { x: edge.source.x, y: edge.source.y }, port2 = { x: edge.target.x, y: edge.target.y }, start = vg2.addPoint(port1, edge.source.index), end = vg2.addPoint(port2, edge.target.index);
            vg2.addEdgeIfVisible(port1, port2, edge.source.index, edge.target.index);
            if (typeof draw !== 'undefined') {
                draw(vg2);
            }
            var sourceInd = e => e.source.id, targetInd = e => e.target.id, length = e => e.length(), spCalc = new shortestpaths_1.Calculator(vg2.V.length, vg2.E, sourceInd, targetInd, length), shortestPath = spCalc.PathFromNodeToNode(start.id, end.id);
            if (shortestPath.length === 1 || shortestPath.length === vg2.V.length) {
                let route = rectangle_1.makeEdgeBetween(edge.source.innerBounds, edge.target.innerBounds, 5);
                lineData = [route.sourceIntersection, route.arrowStart];
            }
            else {
                var n = shortestPath.length - 2, p = vg2.V[shortestPath[n]].p, q = vg2.V[shortestPath[0]].p, lineData = [edge.source.innerBounds.rayIntersection(p.x, p.y)];
                for (var i = n; i >= 0; --i)
                    lineData.push(vg2.V[shortestPath[i]].p);
                lineData.push(rectangle_1.makeEdgeTo(q, edge.target.innerBounds, 5));
            }
            //lineData.forEach((v, i) => {
            //    if (i > 0) {
            //        var u = lineData[i - 1];
            //        this._nodes.forEach(function (node) {
            //            if (node.id === getSourceIndex(d) || node.id === getTargetIndex(d)) return;
            //            var ints = node.innerBounds.lineIntersections(u.x, u.y, v.x, v.y);
            //            if (ints.length > 0) {
            //                debugger;
            //            }
            //        })
            //    }
            //})
            return lineData;
        }
        //The link source and target may be just a node index, or they may be references to nodes themselves.
        static getSourceIndex(e) {
            return typeof e.source === 'number' ? e.source : e.source.index;
        }
        //The link source and target may be just a node index, or they may be references to nodes themselves.
        static getTargetIndex(e) {
            return typeof e.target === 'number' ? e.target : e.target.index;
        }
        // Get a string ID for a given link.
        static linkId(e) {
            return Layout.getSourceIndex(e) + "-" + Layout.getTargetIndex(e);
        }
        // The fixed property has three bits:
        // Bit 1 can be set externally (e.g., d.fixed = true) and show persist.
        // Bit 2 stores the dragging state, from mousedown to mouseup.
        // Bit 3 stores the hover state, from mouseover to mouseout.
        static dragStart(d) {
            if (isGroup(d)) {
                Layout.storeOffset(d, Layout.dragOrigin(d));
            }
            else {
                Layout.stopNode(d);
                d.fixed |= 2; // set bit 2
            }
        }
        // we clobber any existing desired positions for nodes
        // in case another tick event occurs before the drag
        static stopNode(v) {
            v.px = v.x;
            v.py = v.y;
        }
        // we store offsets for each node relative to the centre of the ancestor group
        // being dragged in a pair of properties on the node
        static storeOffset(d, origin) {
            if (typeof d.leaves !== 'undefined') {
                d.leaves.forEach(v => {
                    v.fixed |= 2;
                    Layout.stopNode(v);
                    v._dragGroupOffsetX = v.x - origin.x;
                    v._dragGroupOffsetY = v.y - origin.y;
                });
            }
            if (typeof d.groups !== 'undefined') {
                d.groups.forEach(g => Layout.storeOffset(g, origin));
            }
        }
        // the drag origin is taken as the centre of the node or group
        static dragOrigin(d) {
            if (isGroup(d)) {
                return {
                    x: d.bounds.cx(),
                    y: d.bounds.cy()
                };
            }
            else {
                return d;
            }
        }
        // for groups, the drag translation is propagated down to all of the children of
        // the group.
        static drag(d, position) {
            if (isGroup(d)) {
                if (typeof d.leaves !== 'undefined') {
                    d.leaves.forEach(v => {
                        d.bounds.setXCentre(position.x);
                        d.bounds.setYCentre(position.y);
                        v.px = v._dragGroupOffsetX + position.x;
                        v.py = v._dragGroupOffsetY + position.y;
                    });
                }
                if (typeof d.groups !== 'undefined') {
                    d.groups.forEach(g => Layout.drag(g, position));
                }
            }
            else {
                d.px = position.x;
                d.py = position.y;
            }
        }
        // we unset only bits 2 and 3 so that the user can fix nodes with another a different
        // bit such that the lock persists between drags
        static dragEnd(d) {
            if (isGroup(d)) {
                if (typeof d.leaves !== 'undefined') {
                    d.leaves.forEach(v => {
                        Layout.dragEnd(v);
                        delete v._dragGroupOffsetX;
                        delete v._dragGroupOffsetY;
                    });
                }
                if (typeof d.groups !== 'undefined') {
                    d.groups.forEach(Layout.dragEnd);
                }
            }
            else {
                d.fixed &= ~6; // unset bits 2 and 3
            }
        }
        // in d3 hover temporarily locks nodes, currently not used in cola
        static mouseOver(d) {
            d.fixed |= 4; // set bit 3
            d.px = d.x, d.py = d.y; // set velocity to zero
        }
        // in d3 hover temporarily locks nodes, currently not used in cola
        static mouseOut(d) {
            d.fixed &= ~4; // unset bit 3
        }
    }
    exports.Layout = Layout;
    },{"./descent":8,"./geom":9,"./handledisconnected":11,"./linklengths":14,"./powergraph":15,"./rectangle":18,"./shortestpaths":19}],13:[function(require,module,exports){
    "use strict";
    const shortestpaths_1 = require("./shortestpaths");
    const descent_1 = require("./descent");
    const rectangle_1 = require("./rectangle");
    const linklengths_1 = require("./linklengths");
    class Link3D {
        constructor(source, target) {
            this.source = source;
            this.target = target;
        }
        actualLength(x) {
            return Math.sqrt(x.reduce((c, v) => {
                const dx = v[this.target] - v[this.source];
                return c + dx * dx;
            }, 0));
        }
    }
    exports.Link3D = Link3D;
    class Node3D {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }
    exports.Node3D = Node3D;
    class Layout3D {
        constructor(nodes, links, idealLinkLength = 1) {
            this.nodes = nodes;
            this.links = links;
            this.idealLinkLength = idealLinkLength;
            this.constraints = null;
            this.useJaccardLinkLengths = true;
            this.result = new Array(Layout3D.k);
            for (var i = 0; i < Layout3D.k; ++i) {
                this.result[i] = new Array(nodes.length);
            }
            nodes.forEach((v, i) => {
                for (var dim of Layout3D.dims) {
                    if (typeof v[dim] == 'undefined')
                        v[dim] = Math.random();
                }
                this.result[0][i] = v.x;
                this.result[1][i] = v.y;
                this.result[2][i] = v.z;
            });
        }
        ;
        linkLength(l) {
            return l.actualLength(this.result);
        }
        start(iterations = 100) {
            const n = this.nodes.length;
            var linkAccessor = new LinkAccessor();
            if (this.useJaccardLinkLengths)
                linklengths_1.jaccardLinkLengths(this.links, linkAccessor, 1.5);
            this.links.forEach(e => e.length *= this.idealLinkLength);
            // Create the distance matrix that Cola needs
            const distanceMatrix = (new shortestpaths_1.Calculator(n, this.links, e => e.source, e => e.target, e => e.length)).DistanceMatrix();
            const D = descent_1.Descent.createSquareMatrix(n, (i, j) => distanceMatrix[i][j]);
            // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
            // otherwise 2.
            var G = descent_1.Descent.createSquareMatrix(n, function () { return 2; });
            this.links.forEach(({ source, target }) => G[source][target] = G[target][source] = 1);
            this.descent = new descent_1.Descent(this.result, D);
            this.descent.threshold = 1e-3;
            this.descent.G = G;
            //let constraints = this.links.map(e=> <any>{
            //    axis: 'y', left: e.source, right: e.target, gap: e.length*1.5
            //});
            if (this.constraints)
                this.descent.project = new rectangle_1.Projection(this.nodes, null, null, this.constraints).projectFunctions();
            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.fixed) {
                    this.descent.locks.add(i, [v.x, v.y, v.z]);
                }
            }
            this.descent.run(iterations);
            return this;
        }
        tick() {
            this.descent.locks.clear();
            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.fixed) {
                    this.descent.locks.add(i, [v.x, v.y, v.z]);
                }
            }
            return this.descent.rungeKutta();
        }
    }
    Layout3D.dims = ['x', 'y', 'z'];
    Layout3D.k = Layout3D.dims.length;
    exports.Layout3D = Layout3D;
    class LinkAccessor {
        getSourceIndex(e) { return e.source; }
        getTargetIndex(e) { return e.target; }
        getLength(e) { return e.length; }
        setLength(e, l) { e.length = l; }
    }
    },{"./descent":8,"./linklengths":14,"./rectangle":18,"./shortestpaths":19}],14:[function(require,module,exports){
    "use strict";
    // compute the size of the union of two sets a and b
    function unionCount(a, b) {
        var u = {};
        for (var i in a)
            u[i] = {};
        for (var i in b)
            u[i] = {};
        return Object.keys(u).length;
    }
    // compute the size of the intersection of two sets a and b
    function intersectionCount(a, b) {
        var n = 0;
        for (var i in a)
            if (typeof b[i] !== 'undefined')
                ++n;
        return n;
    }
    function getNeighbours(links, la) {
        var neighbours = {};
        var addNeighbours = (u, v) => {
            if (typeof neighbours[u] === 'undefined')
                neighbours[u] = {};
            neighbours[u][v] = {};
        };
        links.forEach(e => {
            var u = la.getSourceIndex(e), v = la.getTargetIndex(e);
            addNeighbours(u, v);
            addNeighbours(v, u);
        });
        return neighbours;
    }
    // modify the lengths of the specified links by the result of function f weighted by w
    function computeLinkLengths(links, w, f, la) {
        var neighbours = getNeighbours(links, la);
        links.forEach(l => {
            var a = neighbours[la.getSourceIndex(l)];
            var b = neighbours[la.getTargetIndex(l)];
            la.setLength(l, 1 + w * f(a, b));
        });
    }
    /** modify the specified link lengths based on the symmetric difference of their neighbours
     * @class symmetricDiffLinkLengths
     */
    function symmetricDiffLinkLengths(links, la, w = 1) {
        computeLinkLengths(links, w, (a, b) => Math.sqrt(unionCount(a, b) - intersectionCount(a, b)), la);
    }
    exports.symmetricDiffLinkLengths = symmetricDiffLinkLengths;
    /** modify the specified links lengths based on the jaccard difference between their neighbours
     * @class jaccardLinkLengths
     */
    function jaccardLinkLengths(links, la, w = 1) {
        computeLinkLengths(links, w, (a, b) => Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b), la);
    }
    exports.jaccardLinkLengths = jaccardLinkLengths;
    /** generate separation constraints for all edges unless both their source and sink are in the same strongly connected component
     * @class generateDirectedEdgeConstraints
     */
    function generateDirectedEdgeConstraints(n, links, axis, la) {
        var components = stronglyConnectedComponents(n, links, la);
        var nodes = {};
        components.forEach((c, i) => c.forEach(v => nodes[v] = i));
        var constraints = [];
        links.forEach(l => {
            var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l), u = nodes[ui], v = nodes[vi];
            if (u !== v) {
                constraints.push({
                    axis: axis,
                    left: ui,
                    right: vi,
                    gap: la.getMinSeparation(l)
                });
            }
        });
        return constraints;
    }
    exports.generateDirectedEdgeConstraints = generateDirectedEdgeConstraints;
    /**
     * Tarjan's strongly connected components algorithm for directed graphs
     * returns an array of arrays of node indicies in each of the strongly connected components.
     * a vertex not in a SCC of two or more nodes is it's own SCC.
     * adaptation of https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
     */
    function stronglyConnectedComponents(numVertices, edges, la) {
        var nodes = [];
        var index = 0;
        var stack = [];
        var components = [];
        function strongConnect(v) {
            // Set the depth index for v to the smallest unused index
            v.index = v.lowlink = index++;
            stack.push(v);
            v.onStack = true;
            // Consider successors of v
            for (var w of v.out) {
                if (typeof w.index === 'undefined') {
                    // Successor w has not yet been visited; recurse on it
                    strongConnect(w);
                    v.lowlink = Math.min(v.lowlink, w.lowlink);
                }
                else if (w.onStack) {
                    // Successor w is in stack S and hence in the current SCC
                    v.lowlink = Math.min(v.lowlink, w.index);
                }
            }
            // If v is a root node, pop the stack and generate an SCC
            if (v.lowlink === v.index) {
                // start a new strongly connected component
                var component = [];
                while (stack.length) {
                    w = stack.pop();
                    w.onStack = false;
                    //add w to current strongly connected component
                    component.push(w);
                    if (w === v)
                        break;
                }
                // output the current strongly connected component
                components.push(component.map(v => v.id));
            }
        }
        for (var i = 0; i < numVertices; i++) {
            nodes.push({ id: i, out: [] });
        }
        for (var e of edges) {
            let v = nodes[la.getSourceIndex(e)], w = nodes[la.getTargetIndex(e)];
            v.out.push(w);
        }
        for (var v of nodes)
            if (typeof v.index === 'undefined')
                strongConnect(v);
        return components;
    }
    exports.stronglyConnectedComponents = stronglyConnectedComponents;
    },{}],15:[function(require,module,exports){
    "use strict";
    class PowerEdge {
        constructor(source, target, type) {
            this.source = source;
            this.target = target;
            this.type = type;
        }
    }
    exports.PowerEdge = PowerEdge;
    class Configuration {
        constructor(n, edges, linkAccessor, rootGroup) {
            this.linkAccessor = linkAccessor;
            this.modules = new Array(n);
            this.roots = [];
            if (rootGroup) {
                this.initModulesFromGroup(rootGroup);
            }
            else {
                this.roots.push(new ModuleSet());
                for (var i = 0; i < n; ++i)
                    this.roots[0].add(this.modules[i] = new Module(i));
            }
            this.R = edges.length;
            edges.forEach(e => {
                var s = this.modules[linkAccessor.getSourceIndex(e)], t = this.modules[linkAccessor.getTargetIndex(e)], type = linkAccessor.getType(e);
                s.outgoing.add(type, t);
                t.incoming.add(type, s);
            });
        }
        initModulesFromGroup(group) {
            var moduleSet = new ModuleSet();
            this.roots.push(moduleSet);
            for (var i = 0; i < group.leaves.length; ++i) {
                var node = group.leaves[i];
                var module = new Module(node.id);
                this.modules[node.id] = module;
                moduleSet.add(module);
            }
            if (group.groups) {
                for (var j = 0; j < group.groups.length; ++j) {
                    var child = group.groups[j];
                    // Propagate group properties (like padding, stiffness, ...) as module definition so that the generated power graph group will inherit it
                    var definition = {};
                    for (var prop in child)
                        if (prop !== "leaves" && prop !== "groups" && child.hasOwnProperty(prop))
                            definition[prop] = child[prop];
                    // Use negative module id to avoid clashes between predefined and generated modules
                    moduleSet.add(new Module(-1 - j, new LinkSets(), new LinkSets(), this.initModulesFromGroup(child), definition));
                }
            }
            return moduleSet;
        }
        // merge modules a and b keeping track of their power edges and removing the from roots
        merge(a, b, k = 0) {
            var inInt = a.incoming.intersection(b.incoming), outInt = a.outgoing.intersection(b.outgoing);
            var children = new ModuleSet();
            children.add(a);
            children.add(b);
            var m = new Module(this.modules.length, outInt, inInt, children);
            this.modules.push(m);
            var update = (s, i, o) => {
                s.forAll((ms, linktype) => {
                    ms.forAll(n => {
                        var nls = n[i];
                        nls.add(linktype, m);
                        nls.remove(linktype, a);
                        nls.remove(linktype, b);
                        a[o].remove(linktype, n);
                        b[o].remove(linktype, n);
                    });
                });
            };
            update(outInt, "incoming", "outgoing");
            update(inInt, "outgoing", "incoming");
            this.R -= inInt.count() + outInt.count();
            this.roots[k].remove(a);
            this.roots[k].remove(b);
            this.roots[k].add(m);
            return m;
        }
        rootMerges(k = 0) {
            var rs = this.roots[k].modules();
            var n = rs.length;
            var merges = new Array(n * (n - 1));
            var ctr = 0;
            for (var i = 0, i_ = n - 1; i < i_; ++i) {
                for (var j = i + 1; j < n; ++j) {
                    var a = rs[i], b = rs[j];
                    merges[ctr] = { id: ctr, nEdges: this.nEdges(a, b), a: a, b: b };
                    ctr++;
                }
            }
            return merges;
        }
        greedyMerge() {
            for (var i = 0; i < this.roots.length; ++i) {
                // Handle single nested module case
                if (this.roots[i].modules().length < 2)
                    continue;
                // find the merge that allows for the most edges to be removed.  secondary ordering based on arbitrary id (for predictability)
                var ms = this.rootMerges(i).sort((a, b) => a.nEdges == b.nEdges ? a.id - b.id : a.nEdges - b.nEdges);
                var m = ms[0];
                if (m.nEdges >= this.R)
                    continue;
                this.merge(m.a, m.b, i);
                return true;
            }
        }
        nEdges(a, b) {
            var inInt = a.incoming.intersection(b.incoming), outInt = a.outgoing.intersection(b.outgoing);
            return this.R - inInt.count() - outInt.count();
        }
        getGroupHierarchy(retargetedEdges) {
            var groups = [];
            var root = {};
            toGroups(this.roots[0], root, groups);
            var es = this.allEdges();
            es.forEach(e => {
                var a = this.modules[e.source];
                var b = this.modules[e.target];
                retargetedEdges.push(new PowerEdge(typeof a.gid === "undefined" ? e.source : groups[a.gid], typeof b.gid === "undefined" ? e.target : groups[b.gid], e.type));
            });
            return groups;
        }
        allEdges() {
            var es = [];
            Configuration.getEdges(this.roots[0], es);
            return es;
        }
        static getEdges(modules, es) {
            modules.forAll(m => {
                m.getEdges(es);
                Configuration.getEdges(m.children, es);
            });
        }
    }
    exports.Configuration = Configuration;
    function toGroups(modules, group, groups) {
        modules.forAll(m => {
            if (m.isLeaf()) {
                if (!group.leaves)
                    group.leaves = [];
                group.leaves.push(m.id);
            }
            else {
                var g = group;
                m.gid = groups.length;
                if (!m.isIsland() || m.isPredefined()) {
                    g = { id: m.gid };
                    if (m.isPredefined())
                        // Apply original group properties
                        for (var prop in m.definition)
                            g[prop] = m.definition[prop];
                    if (!group.groups)
                        group.groups = [];
                    group.groups.push(m.gid);
                    groups.push(g);
                }
                toGroups(m.children, g, groups);
            }
        });
    }
    class Module {
        constructor(id, outgoing = new LinkSets(), incoming = new LinkSets(), children = new ModuleSet(), definition) {
            this.id = id;
            this.outgoing = outgoing;
            this.incoming = incoming;
            this.children = children;
            this.definition = definition;
        }
        getEdges(es) {
            this.outgoing.forAll((ms, edgetype) => {
                ms.forAll(target => {
                    es.push(new PowerEdge(this.id, target.id, edgetype));
                });
            });
        }
        isLeaf() {
            return this.children.count() === 0;
        }
        isIsland() {
            return this.outgoing.count() === 0 && this.incoming.count() === 0;
        }
        isPredefined() {
            return typeof this.definition !== "undefined";
        }
    }
    exports.Module = Module;
    function intersection(m, n) {
        var i = {};
        for (var v in m)
            if (v in n)
                i[v] = m[v];
        return i;
    }
    class ModuleSet {
        constructor() {
            this.table = {};
        }
        count() {
            return Object.keys(this.table).length;
        }
        intersection(other) {
            var result = new ModuleSet();
            result.table = intersection(this.table, other.table);
            return result;
        }
        intersectionCount(other) {
            return this.intersection(other).count();
        }
        contains(id) {
            return id in this.table;
        }
        add(m) {
            this.table[m.id] = m;
        }
        remove(m) {
            delete this.table[m.id];
        }
        forAll(f) {
            for (var mid in this.table) {
                f(this.table[mid]);
            }
        }
        modules() {
            var vs = [];
            this.forAll(m => {
                if (!m.isPredefined())
                    vs.push(m);
            });
            return vs;
        }
    }
    exports.ModuleSet = ModuleSet;
    class LinkSets {
        constructor() {
            this.sets = {};
            this.n = 0;
        }
        count() {
            return this.n;
        }
        contains(id) {
            var result = false;
            this.forAllModules(m => {
                if (!result && m.id == id) {
                    result = true;
                }
            });
            return result;
        }
        add(linktype, m) {
            var s = linktype in this.sets ? this.sets[linktype] : this.sets[linktype] = new ModuleSet();
            s.add(m);
            ++this.n;
        }
        remove(linktype, m) {
            var ms = this.sets[linktype];
            ms.remove(m);
            if (ms.count() === 0) {
                delete this.sets[linktype];
            }
            --this.n;
        }
        forAll(f) {
            for (var linktype in this.sets) {
                f(this.sets[linktype], Number(linktype));
            }
        }
        forAllModules(f) {
            this.forAll((ms, lt) => ms.forAll(f));
        }
        intersection(other) {
            var result = new LinkSets();
            this.forAll((ms, lt) => {
                if (lt in other.sets) {
                    var i = ms.intersection(other.sets[lt]), n = i.count();
                    if (n > 0) {
                        result.sets[lt] = i;
                        result.n += n;
                    }
                }
            });
            return result;
        }
    }
    exports.LinkSets = LinkSets;
    function intersectionCount(m, n) {
        return Object.keys(intersection(m, n)).length;
    }
    function getGroups(nodes, links, la, rootGroup) {
        var n = nodes.length, c = new Configuration(n, links, la, rootGroup);
        while (c.greedyMerge())
            ;
        var powerEdges = [];
        var g = c.getGroupHierarchy(powerEdges);
        powerEdges.forEach(function (e) {
            var f = (end) => {
                var g = e[end];
                if (typeof g == "number")
                    e[end] = nodes[g];
            };
            f("source");
            f("target");
        });
        return { groups: g, powerEdges: powerEdges };
    }
    exports.getGroups = getGroups;
    },{}],16:[function(require,module,exports){
    "use strict";
    class PairingHeap {
        // from: https://gist.github.com/nervoussystem
        //{elem:object, subheaps:[array of heaps]}
        constructor(elem) {
            this.elem = elem;
            this.subheaps = [];
        }
        toString(selector) {
            var str = "", needComma = false;
            for (var i = 0; i < this.subheaps.length; ++i) {
                var subheap = this.subheaps[i];
                if (!subheap.elem) {
                    needComma = false;
                    continue;
                }
                if (needComma) {
                    str = str + ",";
                }
                str = str + subheap.toString(selector);
                needComma = true;
            }
            if (str !== "") {
                str = "(" + str + ")";
            }
            return (this.elem ? selector(this.elem) : "") + str;
        }
        forEach(f) {
            if (!this.empty()) {
                f(this.elem, this);
                this.subheaps.forEach(s => s.forEach(f));
            }
        }
        count() {
            return this.empty() ? 0 : 1 + this.subheaps.reduce((n, h) => {
                return n + h.count();
            }, 0);
        }
        min() {
            return this.elem;
        }
        empty() {
            return this.elem == null;
        }
        contains(h) {
            if (this === h)
                return true;
            for (var i = 0; i < this.subheaps.length; i++) {
                if (this.subheaps[i].contains(h))
                    return true;
            }
            return false;
        }
        isHeap(lessThan) {
            return this.subheaps.every(h => lessThan(this.elem, h.elem) && h.isHeap(lessThan));
        }
        insert(obj, lessThan) {
            return this.merge(new PairingHeap(obj), lessThan);
        }
        merge(heap2, lessThan) {
            if (this.empty())
                return heap2;
            else if (heap2.empty())
                return this;
            else if (lessThan(this.elem, heap2.elem)) {
                this.subheaps.push(heap2);
                return this;
            }
            else {
                heap2.subheaps.push(this);
                return heap2;
            }
        }
        removeMin(lessThan) {
            if (this.empty())
                return null;
            else
                return this.mergePairs(lessThan);
        }
        mergePairs(lessThan) {
            if (this.subheaps.length == 0)
                return new PairingHeap(null);
            else if (this.subheaps.length == 1) {
                return this.subheaps[0];
            }
            else {
                var firstPair = this.subheaps.pop().merge(this.subheaps.pop(), lessThan);
                var remaining = this.mergePairs(lessThan);
                return firstPair.merge(remaining, lessThan);
            }
        }
        decreaseKey(subheap, newValue, setHeapNode, lessThan) {
            var newHeap = subheap.removeMin(lessThan);
            //reassign subheap values to preserve tree
            subheap.elem = newHeap.elem;
            subheap.subheaps = newHeap.subheaps;
            if (setHeapNode !== null && newHeap.elem !== null) {
                setHeapNode(subheap.elem, subheap);
            }
            var pairingNode = new PairingHeap(newValue);
            if (setHeapNode !== null) {
                setHeapNode(newValue, pairingNode);
            }
            return this.merge(pairingNode, lessThan);
        }
    }
    exports.PairingHeap = PairingHeap;
    /**
     * @class PriorityQueue a min priority queue backed by a pairing heap
     */
    class PriorityQueue {
        constructor(lessThan) {
            this.lessThan = lessThan;
        }
        /**
         * @method top
         * @return the top element (the min element as defined by lessThan)
         */
        top() {
            if (this.empty()) {
                return null;
            }
            return this.root.elem;
        }
        /**
         * @method push
         * put things on the heap
         */
        push(...args) {
            var pairingNode;
            for (var i = 0, arg; arg = args[i]; ++i) {
                pairingNode = new PairingHeap(arg);
                this.root = this.empty() ?
                    pairingNode : this.root.merge(pairingNode, this.lessThan);
            }
            return pairingNode;
        }
        /**
         * @method empty
         * @return true if no more elements in queue
         */
        empty() {
            return !this.root || !this.root.elem;
        }
        /**
         * @method isHeap check heap condition (for testing)
         * @return true if queue is in valid state
         */
        isHeap() {
            return this.root.isHeap(this.lessThan);
        }
        /**
         * @method forEach apply f to each element of the queue
         * @param f function to apply
         */
        forEach(f) {
            this.root.forEach(f);
        }
        /**
         * @method pop remove and return the min element from the queue
         */
        pop() {
            if (this.empty()) {
                return null;
            }
            var obj = this.root.min();
            this.root = this.root.removeMin(this.lessThan);
            return obj;
        }
        /**
         * @method reduceKey reduce the key value of the specified heap node
         */
        reduceKey(heapNode, newKey, setHeapNode = null) {
            this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
        }
        toString(selector) {
            return this.root.toString(selector);
        }
        /**
         * @method count
         * @return number of elements in queue
         */
        count() {
            return this.root.count();
        }
    }
    exports.PriorityQueue = PriorityQueue;
    },{}],17:[function(require,module,exports){
    "use strict";
    //Based on js_es:
    //
    //https://github.com/vadimg/js_bintrees
    //
    //Copyright (C) 2011 by Vadim Graboys
    //
    //Permission is hereby granted, free of charge, to any person obtaining a copy
    //of this software and associated documentation files (the "Software"), to deal
    //in the Software without restriction, including without limitation the rights
    //to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    //copies of the Software, and to permit persons to whom the Software is
    //furnished to do so, subject to the following conditions:
    //
    //The above copyright notice and this permission notice shall be included in
    //all copies or substantial portions of the Software.
    //
    //THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    //IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    //FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    //AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    //LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    //OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    //THE SOFTWARE.
    class TreeBase {
        constructor() {
            // returns iterator to node if found, null otherwise
            this.findIter = function (data) {
                var res = this._root;
                var iter = this.iterator();
                while (res !== null) {
                    var c = this._comparator(data, res.data);
                    if (c === 0) {
                        iter._cursor = res;
                        return iter;
                    }
                    else {
                        iter._ancestors.push(res);
                        res = res.get_child(c > 0);
                    }
                }
                return null;
            };
        }
        // removes all nodes from the tree
        clear() {
            this._root = null;
            this.size = 0;
        }
        ;
        // returns node data if found, null otherwise
        find(data) {
            var res = this._root;
            while (res !== null) {
                var c = this._comparator(data, res.data);
                if (c === 0) {
                    return res.data;
                }
                else {
                    res = res.get_child(c > 0);
                }
            }
            return null;
        }
        ;
        // Returns an interator to the tree node immediately before (or at) the element
        lowerBound(data) {
            return this._bound(data, this._comparator);
        }
        ;
        // Returns an interator to the tree node immediately after (or at) the element
        upperBound(data) {
            var cmp = this._comparator;
            function reverse_cmp(a, b) {
                return cmp(b, a);
            }
            return this._bound(data, reverse_cmp);
        }
        ;
        // returns null if tree is empty
        min() {
            var res = this._root;
            if (res === null) {
                return null;
            }
            while (res.left !== null) {
                res = res.left;
            }
            return res.data;
        }
        ;
        // returns null if tree is empty
        max() {
            var res = this._root;
            if (res === null) {
                return null;
            }
            while (res.right !== null) {
                res = res.right;
            }
            return res.data;
        }
        ;
        // returns a null iterator
        // call next() or prev() to point to an element
        iterator() {
            return new Iterator(this);
        }
        ;
        // calls cb on each node's data, in order
        each(cb) {
            var it = this.iterator(), data;
            while ((data = it.next()) !== null) {
                cb(data);
            }
        }
        ;
        // calls cb on each node's data, in reverse order
        reach(cb) {
            var it = this.iterator(), data;
            while ((data = it.prev()) !== null) {
                cb(data);
            }
        }
        ;
        // used for lowerBound and upperBound
        _bound(data, cmp) {
            var cur = this._root;
            var iter = this.iterator();
            while (cur !== null) {
                var c = this._comparator(data, cur.data);
                if (c === 0) {
                    iter._cursor = cur;
                    return iter;
                }
                iter._ancestors.push(cur);
                cur = cur.get_child(c > 0);
            }
            for (var i = iter._ancestors.length - 1; i >= 0; --i) {
                cur = iter._ancestors[i];
                if (cmp(data, cur.data) > 0) {
                    iter._cursor = cur;
                    iter._ancestors.length = i;
                    return iter;
                }
            }
            iter._ancestors.length = 0;
            return iter;
        }
        ;
    }
    exports.TreeBase = TreeBase;
    class Iterator {
        constructor(tree) {
            this._tree = tree;
            this._ancestors = [];
            this._cursor = null;
        }
        data() {
            return this._cursor !== null ? this._cursor.data : null;
        }
        ;
        // if null-iterator, returns first node
        // otherwise, returns next node
        next() {
            if (this._cursor === null) {
                var root = this._tree._root;
                if (root !== null) {
                    this._minNode(root);
                }
            }
            else {
                if (this._cursor.right === null) {
                    // no greater node in subtree, go up to parent
                    // if coming from a right child, continue up the stack
                    var save;
                    do {
                        save = this._cursor;
                        if (this._ancestors.length) {
                            this._cursor = this._ancestors.pop();
                        }
                        else {
                            this._cursor = null;
                            break;
                        }
                    } while (this._cursor.right === save);
                }
                else {
                    // get the next node from the subtree
                    this._ancestors.push(this._cursor);
                    this._minNode(this._cursor.right);
                }
            }
            return this._cursor !== null ? this._cursor.data : null;
        }
        ;
        // if null-iterator, returns last node
        // otherwise, returns previous node
        prev() {
            if (this._cursor === null) {
                var root = this._tree._root;
                if (root !== null) {
                    this._maxNode(root);
                }
            }
            else {
                if (this._cursor.left === null) {
                    var save;
                    do {
                        save = this._cursor;
                        if (this._ancestors.length) {
                            this._cursor = this._ancestors.pop();
                        }
                        else {
                            this._cursor = null;
                            break;
                        }
                    } while (this._cursor.left === save);
                }
                else {
                    this._ancestors.push(this._cursor);
                    this._maxNode(this._cursor.left);
                }
            }
            return this._cursor !== null ? this._cursor.data : null;
        }
        ;
        _minNode(start) {
            while (start.left !== null) {
                this._ancestors.push(start);
                start = start.left;
            }
            this._cursor = start;
        }
        ;
        _maxNode(start) {
            while (start.right !== null) {
                this._ancestors.push(start);
                start = start.right;
            }
            this._cursor = start;
        }
        ;
    }
    exports.Iterator = Iterator;
    class Node {
        constructor(data) {
            this.data = data;
            this.left = null;
            this.right = null;
            this.red = true;
        }
        get_child(dir) {
            return dir ? this.right : this.left;
        }
        ;
        set_child(dir, val) {
            if (dir) {
                this.right = val;
            }
            else {
                this.left = val;
            }
        }
        ;
    }
    class RBTree extends TreeBase {
        constructor(comparator) {
            super();
            this._root = null;
            this._comparator = comparator;
            this.size = 0;
        }
        // returns true if inserted, false if duplicate
        insert(data) {
            var ret = false;
            if (this._root === null) {
                // empty tree
                this._root = new Node(data);
                ret = true;
                this.size++;
            }
            else {
                var head = new Node(undefined); // fake tree root
                var dir = false;
                var last = false;
                // setup
                var gp = null; // grandparent
                var ggp = head; // grand-grand-parent
                var p = null; // parent
                var node = this._root;
                ggp.right = this._root;
                // search down
                while (true) {
                    if (node === null) {
                        // insert new node at the bottom
                        node = new Node(data);
                        p.set_child(dir, node);
                        ret = true;
                        this.size++;
                    }
                    else if (RBTree.is_red(node.left) && RBTree.is_red(node.right)) {
                        // color flip
                        node.red = true;
                        node.left.red = false;
                        node.right.red = false;
                    }
                    // fix red violation
                    if (RBTree.is_red(node) && RBTree.is_red(p)) {
                        var dir2 = ggp.right === gp;
                        if (node === p.get_child(last)) {
                            ggp.set_child(dir2, RBTree.single_rotate(gp, !last));
                        }
                        else {
                            ggp.set_child(dir2, RBTree.double_rotate(gp, !last));
                        }
                    }
                    var cmp = this._comparator(node.data, data);
                    // stop if found
                    if (cmp === 0) {
                        break;
                    }
                    last = dir;
                    dir = cmp < 0;
                    // update helpers
                    if (gp !== null) {
                        ggp = gp;
                    }
                    gp = p;
                    p = node;
                    node = node.get_child(dir);
                }
                // update root
                this._root = head.right;
            }
            // make root black
            this._root.red = false;
            return ret;
        }
        ;
        // returns true if removed, false if not found
        remove(data) {
            if (this._root === null) {
                return false;
            }
            var head = new Node(undefined); // fake tree root
            var node = head;
            node.right = this._root;
            var p = null; // parent
            var gp = null; // grand parent
            var found = null; // found item
            var dir = true;
            while (node.get_child(dir) !== null) {
                var last = dir;
                // update helpers
                gp = p;
                p = node;
                node = node.get_child(dir);
                var cmp = this._comparator(data, node.data);
                dir = cmp > 0;
                // save found node
                if (cmp === 0) {
                    found = node;
                }
                // push the red node down
                if (!RBTree.is_red(node) && !RBTree.is_red(node.get_child(dir))) {
                    if (RBTree.is_red(node.get_child(!dir))) {
                        var sr = RBTree.single_rotate(node, dir);
                        p.set_child(last, sr);
                        p = sr;
                    }
                    else if (!RBTree.is_red(node.get_child(!dir))) {
                        var sibling = p.get_child(!last);
                        if (sibling !== null) {
                            if (!RBTree.is_red(sibling.get_child(!last)) && !RBTree.is_red(sibling.get_child(last))) {
                                // color flip
                                p.red = false;
                                sibling.red = true;
                                node.red = true;
                            }
                            else {
                                var dir2 = gp.right === p;
                                if (RBTree.is_red(sibling.get_child(last))) {
                                    gp.set_child(dir2, RBTree.double_rotate(p, last));
                                }
                                else if (RBTree.is_red(sibling.get_child(!last))) {
                                    gp.set_child(dir2, RBTree.single_rotate(p, last));
                                }
                                // ensure correct coloring
                                var gpc = gp.get_child(dir2);
                                gpc.red = true;
                                node.red = true;
                                gpc.left.red = false;
                                gpc.right.red = false;
                            }
                        }
                    }
                }
            }
            // replace and remove if found
            if (found !== null) {
                found.data = node.data;
                p.set_child(p.right === node, node.get_child(node.left === null));
                this.size--;
            }
            // update root and make it black
            this._root = head.right;
            if (this._root !== null) {
                this._root.red = false;
            }
            return found !== null;
        }
        ;
        static is_red(node) {
            return node !== null && node.red;
        }
        static single_rotate(root, dir) {
            var save = root.get_child(!dir);
            root.set_child(!dir, save.get_child(dir));
            save.set_child(dir, root);
            root.red = true;
            save.red = false;
            return save;
        }
        static double_rotate(root, dir) {
            root.set_child(!dir, RBTree.single_rotate(root.get_child(!dir), !dir));
            return RBTree.single_rotate(root, dir);
        }
    }
    exports.RBTree = RBTree;
    },{}],18:[function(require,module,exports){
    "use strict";
    const vpsc_1 = require("./vpsc");
    const rbtree_1 = require("./rbtree");
    function computeGroupBounds(g) {
        g.bounds = typeof g.leaves !== "undefined" ?
            g.leaves.reduce((r, c) => c.bounds.union(r), Rectangle.empty()) :
            Rectangle.empty();
        if (typeof g.groups !== "undefined")
            g.bounds = g.groups.reduce((r, c) => computeGroupBounds(c).union(r), g.bounds);
        g.bounds = g.bounds.inflate(g.padding);
        return g.bounds;
    }
    exports.computeGroupBounds = computeGroupBounds;
    class Rectangle {
        constructor(x, X, y, Y) {
            this.x = x;
            this.X = X;
            this.y = y;
            this.Y = Y;
        }
        static empty() { return new Rectangle(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY); }
        cx() { return (this.x + this.X) / 2; }
        cy() { return (this.y + this.Y) / 2; }
        overlapX(r) {
            var ux = this.cx(), vx = r.cx();
            if (ux <= vx && r.x < this.X)
                return this.X - r.x;
            if (vx <= ux && this.x < r.X)
                return r.X - this.x;
            return 0;
        }
        overlapY(r) {
            var uy = this.cy(), vy = r.cy();
            if (uy <= vy && r.y < this.Y)
                return this.Y - r.y;
            if (vy <= uy && this.y < r.Y)
                return r.Y - this.y;
            return 0;
        }
        setXCentre(cx) {
            var dx = cx - this.cx();
            this.x += dx;
            this.X += dx;
        }
        setYCentre(cy) {
            var dy = cy - this.cy();
            this.y += dy;
            this.Y += dy;
        }
        width() {
            return this.X - this.x;
        }
        height() {
            return this.Y - this.y;
        }
        union(r) {
            return new Rectangle(Math.min(this.x, r.x), Math.max(this.X, r.X), Math.min(this.y, r.y), Math.max(this.Y, r.Y));
        }
        /**
         * return any intersection points between the given line and the sides of this rectangle
         * @method lineIntersection
         * @param x1 number first x coord of line
         * @param y1 number first y coord of line
         * @param x2 number second x coord of line
         * @param y2 number second y coord of line
         * @return any intersection points found
         */
        lineIntersections(x1, y1, x2, y2) {
            var sides = [[this.x, this.y, this.X, this.y],
                [this.X, this.y, this.X, this.Y],
                [this.X, this.Y, this.x, this.Y],
                [this.x, this.Y, this.x, this.y]];
            var intersections = [];
            for (var i = 0; i < 4; ++i) {
                var r = Rectangle.lineIntersection(x1, y1, x2, y2, sides[i][0], sides[i][1], sides[i][2], sides[i][3]);
                if (r !== null)
                    intersections.push({ x: r.x, y: r.y });
            }
            return intersections;
        }
        /**
         * return any intersection points between a line extending from the centre of this rectangle to the given point,
         *  and the sides of this rectangle
         * @method lineIntersection
         * @param x2 number second x coord of line
         * @param y2 number second y coord of line
         * @return any intersection points found
         */
        rayIntersection(x2, y2) {
            var ints = this.lineIntersections(this.cx(), this.cy(), x2, y2);
            return ints.length > 0 ? ints[0] : null;
        }
        vertices() {
            return [
                { x: this.x, y: this.y },
                { x: this.X, y: this.y },
                { x: this.X, y: this.Y },
                { x: this.x, y: this.Y },
                { x: this.x, y: this.y }
            ];
        }
        static lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
            var dx12 = x2 - x1, dx34 = x4 - x3, dy12 = y2 - y1, dy34 = y4 - y3, denominator = dy34 * dx12 - dx34 * dy12;
            if (denominator == 0)
                return null;
            var dx31 = x1 - x3, dy31 = y1 - y3, numa = dx34 * dy31 - dy34 * dx31, a = numa / denominator, numb = dx12 * dy31 - dy12 * dx31, b = numb / denominator;
            if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
                return {
                    x: x1 + a * dx12,
                    y: y1 + a * dy12
                };
            }
            return null;
        }
        inflate(pad) {
            return new Rectangle(this.x - pad, this.X + pad, this.y - pad, this.Y + pad);
        }
    }
    exports.Rectangle = Rectangle;
    function makeEdgeBetween(source, target, ah) {
        const si = source.rayIntersection(target.cx(), target.cy()) || { x: source.cx(), y: source.cy() }, ti = target.rayIntersection(source.cx(), source.cy()) || { x: target.cx(), y: target.cy() }, dx = ti.x - si.x, dy = ti.y - si.y, l = Math.sqrt(dx * dx + dy * dy), al = l - ah;
        return {
            sourceIntersection: si,
            targetIntersection: ti,
            arrowStart: { x: si.x + al * dx / l, y: si.y + al * dy / l }
        };
    }
    exports.makeEdgeBetween = makeEdgeBetween;
    function makeEdgeTo(s, target, ah) {
        var ti = target.rayIntersection(s.x, s.y);
        if (!ti)
            ti = { x: target.cx(), y: target.cy() };
        var dx = ti.x - s.x, dy = ti.y - s.y, l = Math.sqrt(dx * dx + dy * dy);
        return { x: ti.x - ah * dx / l, y: ti.y - ah * dy / l };
    }
    exports.makeEdgeTo = makeEdgeTo;
    class Node {
        constructor(v, r, pos) {
            this.v = v;
            this.r = r;
            this.pos = pos;
            this.prev = makeRBTree();
            this.next = makeRBTree();
        }
    }
    class Event {
        constructor(isOpen, v, pos) {
            this.isOpen = isOpen;
            this.v = v;
            this.pos = pos;
        }
    }
    function compareEvents(a, b) {
        if (a.pos > b.pos) {
            return 1;
        }
        if (a.pos < b.pos) {
            return -1;
        }
        if (a.isOpen) {
            // open must come before close
            return -1;
        }
        if (b.isOpen) {
            // open must come before close
            return 1;
        }
        return 0;
    }
    function makeRBTree() {
        return new rbtree_1.RBTree((a, b) => a.pos - b.pos);
    }
    var xRect = {
        getCentre: r => r.cx(),
        getOpen: r => r.y,
        getClose: r => r.Y,
        getSize: r => r.width(),
        makeRect: (open, close, center, size) => new Rectangle(center - size / 2, center + size / 2, open, close),
        findNeighbours: findXNeighbours
    };
    var yRect = {
        getCentre: r => r.cy(),
        getOpen: r => r.x,
        getClose: r => r.X,
        getSize: r => r.height(),
        makeRect: (open, close, center, size) => new Rectangle(open, close, center - size / 2, center + size / 2),
        findNeighbours: findYNeighbours
    };
    function generateGroupConstraints(root, f, minSep, isContained = false) {
        var padding = root.padding, gn = typeof root.groups !== 'undefined' ? root.groups.length : 0, ln = typeof root.leaves !== 'undefined' ? root.leaves.length : 0, childConstraints = !gn ? []
            : root.groups.reduce((ccs, g) => ccs.concat(generateGroupConstraints(g, f, minSep, true)), []), n = (isContained ? 2 : 0) + ln + gn, vs = new Array(n), rs = new Array(n), i = 0, add = (r, v) => { rs[i] = r; vs[i++] = v; };
        if (isContained) {
            // if this group is contained by another, then we add two dummy vars and rectangles for the borders
            var b = root.bounds, c = f.getCentre(b), s = f.getSize(b) / 2, open = f.getOpen(b), close = f.getClose(b), min = c - s + padding / 2, max = c + s - padding / 2;
            root.minVar.desiredPosition = min;
            add(f.makeRect(open, close, min, padding), root.minVar);
            root.maxVar.desiredPosition = max;
            add(f.makeRect(open, close, max, padding), root.maxVar);
        }
        if (ln)
            root.leaves.forEach(l => add(l.bounds, l.variable));
        if (gn)
            root.groups.forEach(g => {
                var b = g.bounds;
                add(f.makeRect(f.getOpen(b), f.getClose(b), f.getCentre(b), f.getSize(b)), g.minVar);
            });
        var cs = generateConstraints(rs, vs, f, minSep);
        if (gn) {
            vs.forEach(v => { v.cOut = [], v.cIn = []; });
            cs.forEach(c => { c.left.cOut.push(c), c.right.cIn.push(c); });
            root.groups.forEach(g => {
                var gapAdjustment = (g.padding - f.getSize(g.bounds)) / 2;
                g.minVar.cIn.forEach(c => c.gap += gapAdjustment);
                g.minVar.cOut.forEach(c => { c.left = g.maxVar; c.gap += gapAdjustment; });
            });
        }
        return childConstraints.concat(cs);
    }
    function generateConstraints(rs, vars, rect, minSep) {
        var i, n = rs.length;
        var N = 2 * n;
        console.assert(vars.length >= n);
        var events = new Array(N);
        for (i = 0; i < n; ++i) {
            var r = rs[i];
            var v = new Node(vars[i], r, rect.getCentre(r));
            events[i] = new Event(true, v, rect.getOpen(r));
            events[i + n] = new Event(false, v, rect.getClose(r));
        }
        events.sort(compareEvents);
        var cs = new Array();
        var scanline = makeRBTree();
        for (i = 0; i < N; ++i) {
            var e = events[i];
            var v = e.v;
            if (e.isOpen) {
                scanline.insert(v);
                rect.findNeighbours(v, scanline);
            }
            else {
                // close event
                scanline.remove(v);
                var makeConstraint = (l, r) => {
                    var sep = (rect.getSize(l.r) + rect.getSize(r.r)) / 2 + minSep;
                    cs.push(new vpsc_1.Constraint(l.v, r.v, sep));
                };
                var visitNeighbours = (forward, reverse, mkcon) => {
                    var u, it = v[forward].iterator();
                    while ((u = it[forward]()) !== null) {
                        mkcon(u, v);
                        u[reverse].remove(v);
                    }
                };
                visitNeighbours("prev", "next", (u, v) => makeConstraint(u, v));
                visitNeighbours("next", "prev", (u, v) => makeConstraint(v, u));
            }
        }
        console.assert(scanline.size === 0);
        return cs;
    }
    function findXNeighbours(v, scanline) {
        var f = (forward, reverse) => {
            var it = scanline.findIter(v);
            var u;
            while ((u = it[forward]()) !== null) {
                var uovervX = u.r.overlapX(v.r);
                if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                    v[forward].insert(u);
                    u[reverse].insert(v);
                }
                if (uovervX <= 0) {
                    break;
                }
            }
        };
        f("next", "prev");
        f("prev", "next");
    }
    function findYNeighbours(v, scanline) {
        var f = (forward, reverse) => {
            var u = scanline.findIter(v)[forward]();
            if (u !== null && u.r.overlapX(v.r) > 0) {
                v[forward].insert(u);
                u[reverse].insert(v);
            }
        };
        f("next", "prev");
        f("prev", "next");
    }
    function generateXConstraints(rs, vars) {
        return generateConstraints(rs, vars, xRect, 1e-6);
    }
    exports.generateXConstraints = generateXConstraints;
    function generateYConstraints(rs, vars) {
        return generateConstraints(rs, vars, yRect, 1e-6);
    }
    exports.generateYConstraints = generateYConstraints;
    function generateXGroupConstraints(root) {
        return generateGroupConstraints(root, xRect, 1e-6);
    }
    exports.generateXGroupConstraints = generateXGroupConstraints;
    function generateYGroupConstraints(root) {
        return generateGroupConstraints(root, yRect, 1e-6);
    }
    exports.generateYGroupConstraints = generateYGroupConstraints;
    function removeOverlaps(rs) {
        var vs = rs.map(r => new vpsc_1.Variable(r.cx()));
        var cs = generateXConstraints(rs, vs);
        var solver = new vpsc_1.Solver(vs, cs);
        solver.solve();
        vs.forEach((v, i) => rs[i].setXCentre(v.position()));
        vs = rs.map(r => new vpsc_1.Variable(r.cy()));
        cs = generateYConstraints(rs, vs);
        solver = new vpsc_1.Solver(vs, cs);
        solver.solve();
        vs.forEach((v, i) => rs[i].setYCentre(v.position()));
    }
    exports.removeOverlaps = removeOverlaps;
    class IndexedVariable extends vpsc_1.Variable {
        constructor(index, w) {
            super(0, w);
            this.index = index;
        }
    }
    exports.IndexedVariable = IndexedVariable;
    class Projection {
        constructor(nodes, groups, rootGroup = null, constraints = null, avoidOverlaps = false) {
            this.nodes = nodes;
            this.groups = groups;
            this.rootGroup = rootGroup;
            this.avoidOverlaps = avoidOverlaps;
            this.variables = nodes.map((v, i) => {
                return v.variable = new IndexedVariable(i, 1);
            });
            if (constraints)
                this.createConstraints(constraints);
            if (avoidOverlaps && rootGroup && typeof rootGroup.groups !== 'undefined') {
                nodes.forEach(v => {
                    if (!v.width || !v.height) {
                        //If undefined, default to nothing
                        v.bounds = new Rectangle(v.x, v.x, v.y, v.y);
                        return;
                    }
                    var w2 = v.width / 2, h2 = v.height / 2;
                    v.bounds = new Rectangle(v.x - w2, v.x + w2, v.y - h2, v.y + h2);
                });
                computeGroupBounds(rootGroup);
                var i = nodes.length;
                groups.forEach(g => {
                    this.variables[i] = g.minVar = new IndexedVariable(i++, typeof g.stiffness !== "undefined" ? g.stiffness : 0.01);
                    this.variables[i] = g.maxVar = new IndexedVariable(i++, typeof g.stiffness !== "undefined" ? g.stiffness : 0.01);
                });
            }
        }
        createSeparation(c) {
            return new vpsc_1.Constraint(this.nodes[c.left].variable, this.nodes[c.right].variable, c.gap, typeof c.equality !== "undefined" ? c.equality : false);
        }
        makeFeasible(c) {
            if (!this.avoidOverlaps)
                return;
            var axis = 'x', dim = 'width';
            if (c.axis === 'x')
                axis = 'y', dim = 'height';
            var vs = c.offsets.map(o => this.nodes[o.node]).sort((a, b) => a[axis] - b[axis]);
            var p = null;
            vs.forEach(v => {
                if (p)
                    v[axis] = p[axis] + p[dim] + 1;
                p = v;
            });
        }
        createAlignment(c) {
            var u = this.nodes[c.offsets[0].node].variable;
            this.makeFeasible(c);
            var cs = c.axis === 'x' ? this.xConstraints : this.yConstraints;
            c.offsets.slice(1).forEach(o => {
                var v = this.nodes[o.node].variable;
                cs.push(new vpsc_1.Constraint(u, v, o.offset, true));
            });
        }
        createConstraints(constraints) {
            var isSep = c => typeof c.type === 'undefined' || c.type === 'separation';
            this.xConstraints = constraints
                .filter(c => c.axis === "x" && isSep(c))
                .map(c => this.createSeparation(c));
            this.yConstraints = constraints
                .filter(c => c.axis === "y" && isSep(c))
                .map(c => this.createSeparation(c));
            constraints
                .filter(c => c.type === 'alignment')
                .forEach(c => this.createAlignment(c));
        }
        setupVariablesAndBounds(x0, y0, desired, getDesired) {
            this.nodes.forEach((v, i) => {
                if (v.fixed) {
                    v.variable.weight = v.fixedWeight ? v.fixedWeight : 1000;
                    desired[i] = getDesired(v);
                }
                else {
                    v.variable.weight = 1;
                }
                var w = (v.width || 0) / 2, h = (v.height || 0) / 2;
                var ix = x0[i], iy = y0[i];
                v.bounds = new Rectangle(ix - w, ix + w, iy - h, iy + h);
            });
        }
        xProject(x0, y0, x) {
            if (!this.rootGroup && !(this.avoidOverlaps || this.xConstraints))
                return;
            this.project(x0, y0, x0, x, v => v.px, this.xConstraints, generateXGroupConstraints, v => v.bounds.setXCentre(x[v.variable.index] = v.variable.position()), g => {
                var xmin = x[g.minVar.index] = g.minVar.position();
                var xmax = x[g.maxVar.index] = g.maxVar.position();
                var p2 = g.padding / 2;
                g.bounds.x = xmin - p2;
                g.bounds.X = xmax + p2;
            });
        }
        yProject(x0, y0, y) {
            if (!this.rootGroup && !this.yConstraints)
                return;
            this.project(x0, y0, y0, y, v => v.py, this.yConstraints, generateYGroupConstraints, v => v.bounds.setYCentre(y[v.variable.index] = v.variable.position()), g => {
                var ymin = y[g.minVar.index] = g.minVar.position();
                var ymax = y[g.maxVar.index] = g.maxVar.position();
                var p2 = g.padding / 2;
                g.bounds.y = ymin - p2;
                ;
                g.bounds.Y = ymax + p2;
            });
        }
        projectFunctions() {
            return [
                (x0, y0, x) => this.xProject(x0, y0, x),
                (x0, y0, y) => this.yProject(x0, y0, y)
            ];
        }
        project(x0, y0, start, desired, getDesired, cs, generateConstraints, updateNodeBounds, updateGroupBounds) {
            this.setupVariablesAndBounds(x0, y0, desired, getDesired);
            if (this.rootGroup && this.avoidOverlaps) {
                computeGroupBounds(this.rootGroup);
                cs = cs.concat(generateConstraints(this.rootGroup));
            }
            this.solve(this.variables, cs, start, desired);
            this.nodes.forEach(updateNodeBounds);
            if (this.rootGroup && this.avoidOverlaps) {
                this.groups.forEach(updateGroupBounds);
                computeGroupBounds(this.rootGroup);
            }
        }
        solve(vs, cs, starting, desired) {
            var solver = new vpsc_1.Solver(vs, cs);
            solver.setStartingPositions(starting);
            solver.setDesiredPositions(desired);
            solver.solve();
        }
    }
    exports.Projection = Projection;
    },{"./rbtree":17,"./vpsc":20}],19:[function(require,module,exports){
    "use strict";
    const pqueue_1 = require("./pqueue");
    class Neighbour {
        constructor(id, distance) {
            this.id = id;
            this.distance = distance;
        }
    }
    class Node {
        constructor(id) {
            this.id = id;
            this.neighbours = [];
        }
    }
    class QueueEntry {
        constructor(node, prev, d) {
            this.node = node;
            this.prev = prev;
            this.d = d;
        }
    }
    /**
     * calculates all-pairs shortest paths or shortest paths from a single node
     * @class Calculator
     * @constructor
     * @param n {number} number of nodes
     * @param es {Edge[]} array of edges
     */
    class Calculator {
        constructor(n, es, getSourceIndex, getTargetIndex, getLength) {
            this.n = n;
            this.es = es;
            this.neighbours = new Array(this.n);
            var i = this.n;
            while (i--)
                this.neighbours[i] = new Node(i);
            i = this.es.length;
            while (i--) {
                var e = this.es[i];
                var u = getSourceIndex(e), v = getTargetIndex(e);
                var d = getLength(e);
                this.neighbours[u].neighbours.push(new Neighbour(v, d));
                this.neighbours[v].neighbours.push(new Neighbour(u, d));
            }
        }
        /**
         * compute shortest paths for graph over n nodes with edges an array of source/target pairs
         * edges may optionally have a length attribute.  1 is the default.
         * Uses Johnson's algorithm.
         *
         * @method DistanceMatrix
         * @return the distance matrix
         */
        DistanceMatrix() {
            var D = new Array(this.n);
            for (var i = 0; i < this.n; ++i) {
                D[i] = this.dijkstraNeighbours(i);
            }
            return D;
        }
        /**
         * get shortest paths from a specified start node
         * @method DistancesFromNode
         * @param start node index
         * @return array of path lengths
         */
        DistancesFromNode(start) {
            return this.dijkstraNeighbours(start);
        }
        PathFromNodeToNode(start, end) {
            return this.dijkstraNeighbours(start, end);
        }
        // find shortest path from start to end, with the opportunity at
        // each edge traversal to compute a custom cost based on the
        // previous edge.  For example, to penalise bends.
        PathFromNodeToNodeWithPrevCost(start, end, prevCost) {
            var q = new pqueue_1.PriorityQueue((a, b) => a.d <= b.d), u = this.neighbours[start], qu = new QueueEntry(u, null, 0), visitedFrom = {};
            q.push(qu);
            while (!q.empty()) {
                qu = q.pop();
                u = qu.node;
                if (u.id === end) {
                    break;
                }
                var i = u.neighbours.length;
                while (i--) {
                    var neighbour = u.neighbours[i], v = this.neighbours[neighbour.id];
                    // don't double back
                    if (qu.prev && v.id === qu.prev.node.id)
                        continue;
                    // don't retraverse an edge if it has already been explored
                    // from a lower cost route
                    var viduid = v.id + ',' + u.id;
                    if (viduid in visitedFrom && visitedFrom[viduid] <= qu.d)
                        continue;
                    var cc = qu.prev ? prevCost(qu.prev.node.id, u.id, v.id) : 0, t = qu.d + neighbour.distance + cc;
                    // store cost of this traversal
                    visitedFrom[viduid] = t;
                    q.push(new QueueEntry(v, qu, t));
                }
            }
            var path = [];
            while (qu.prev) {
                qu = qu.prev;
                path.push(qu.node.id);
            }
            return path;
        }
        dijkstraNeighbours(start, dest = -1) {
            var q = new pqueue_1.PriorityQueue((a, b) => a.d <= b.d), i = this.neighbours.length, d = new Array(i);
            while (i--) {
                var node = this.neighbours[i];
                node.d = i === start ? 0 : Number.POSITIVE_INFINITY;
                node.q = q.push(node);
            }
            while (!q.empty()) {
                // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.POSITIVE_INFINITY ? "\u221E" : u.d.toFixed(2) )}));
                var u = q.pop();
                d[u.id] = u.d;
                if (u.id === dest) {
                    var path = [];
                    var v = u;
                    while (typeof v.prev !== 'undefined') {
                        path.push(v.prev.id);
                        v = v.prev;
                    }
                    return path;
                }
                i = u.neighbours.length;
                while (i--) {
                    var neighbour = u.neighbours[i];
                    var v = this.neighbours[neighbour.id];
                    var t = u.d + neighbour.distance;
                    if (u.d !== Number.MAX_VALUE && v.d > t) {
                        v.d = t;
                        v.prev = u;
                        q.reduceKey(v.q, v, (e, q) => e.q = q);
                    }
                }
            }
            return d;
        }
    }
    exports.Calculator = Calculator;
    },{"./pqueue":16}],20:[function(require,module,exports){
    "use strict";
    class PositionStats {
        constructor(scale) {
            this.scale = scale;
            this.AB = 0;
            this.AD = 0;
            this.A2 = 0;
        }
        addVariable(v) {
            var ai = this.scale / v.scale;
            var bi = v.offset / v.scale;
            var wi = v.weight;
            this.AB += wi * ai * bi;
            this.AD += wi * ai * v.desiredPosition;
            this.A2 += wi * ai * ai;
        }
        getPosn() {
            return (this.AD - this.AB) / this.A2;
        }
    }
    exports.PositionStats = PositionStats;
    class Constraint {
        constructor(left, right, gap, equality = false) {
            this.left = left;
            this.right = right;
            this.gap = gap;
            this.equality = equality;
            this.active = false;
            this.unsatisfiable = false;
            this.left = left;
            this.right = right;
            this.gap = gap;
            this.equality = equality;
        }
        slack() {
            return this.unsatisfiable ? Number.MAX_VALUE
                : this.right.scale * this.right.position() - this.gap
                    - this.left.scale * this.left.position();
        }
    }
    exports.Constraint = Constraint;
    class Variable {
        constructor(desiredPosition, weight = 1, scale = 1) {
            this.desiredPosition = desiredPosition;
            this.weight = weight;
            this.scale = scale;
            this.offset = 0;
        }
        dfdv() {
            return 2.0 * this.weight * (this.position() - this.desiredPosition);
        }
        position() {
            return (this.block.ps.scale * this.block.posn + this.offset) / this.scale;
        }
        // visit neighbours by active constraints within the same block
        visitNeighbours(prev, f) {
            var ff = (c, next) => c.active && prev !== next && f(c, next);
            this.cOut.forEach(c => ff(c, c.right));
            this.cIn.forEach(c => ff(c, c.left));
        }
    }
    exports.Variable = Variable;
    class Block {
        constructor(v) {
            this.vars = [];
            v.offset = 0;
            this.ps = new PositionStats(v.scale);
            this.addVariable(v);
        }
        addVariable(v) {
            v.block = this;
            this.vars.push(v);
            this.ps.addVariable(v);
            this.posn = this.ps.getPosn();
        }
        // move the block where it needs to be to minimize cost
        updateWeightedPosition() {
            this.ps.AB = this.ps.AD = this.ps.A2 = 0;
            for (var i = 0, n = this.vars.length; i < n; ++i)
                this.ps.addVariable(this.vars[i]);
            this.posn = this.ps.getPosn();
        }
        compute_lm(v, u, postAction) {
            var dfdv = v.dfdv();
            v.visitNeighbours(u, (c, next) => {
                var _dfdv = this.compute_lm(next, v, postAction);
                if (next === c.right) {
                    dfdv += _dfdv * c.left.scale;
                    c.lm = _dfdv;
                }
                else {
                    dfdv += _dfdv * c.right.scale;
                    c.lm = -_dfdv;
                }
                postAction(c);
            });
            return dfdv / v.scale;
        }
        populateSplitBlock(v, prev) {
            v.visitNeighbours(prev, (c, next) => {
                next.offset = v.offset + (next === c.right ? c.gap : -c.gap);
                this.addVariable(next);
                this.populateSplitBlock(next, v);
            });
        }
        // traverse the active constraint tree applying visit to each active constraint
        traverse(visit, acc, v = this.vars[0], prev = null) {
            v.visitNeighbours(prev, (c, next) => {
                acc.push(visit(c));
                this.traverse(visit, acc, next, v);
            });
        }
        // calculate lagrangian multipliers on constraints and
        // find the active constraint in this block with the smallest lagrangian.
        // if the lagrangian is negative, then the constraint is a split candidate.
        findMinLM() {
            var m = null;
            this.compute_lm(this.vars[0], null, c => {
                if (!c.equality && (m === null || c.lm < m.lm))
                    m = c;
            });
            return m;
        }
        findMinLMBetween(lv, rv) {
            this.compute_lm(lv, null, () => { });
            var m = null;
            this.findPath(lv, null, rv, (c, next) => {
                if (!c.equality && c.right === next && (m === null || c.lm < m.lm))
                    m = c;
            });
            return m;
        }
        findPath(v, prev, to, visit) {
            var endFound = false;
            v.visitNeighbours(prev, (c, next) => {
                if (!endFound && (next === to || this.findPath(next, v, to, visit))) {
                    endFound = true;
                    visit(c, next);
                }
            });
            return endFound;
        }
        // Search active constraint tree from u to see if there is a directed path to v.
        // Returns true if path is found.
        isActiveDirectedPathBetween(u, v) {
            if (u === v)
                return true;
            var i = u.cOut.length;
            while (i--) {
                var c = u.cOut[i];
                if (c.active && this.isActiveDirectedPathBetween(c.right, v))
                    return true;
            }
            return false;
        }
        // split the block into two by deactivating the specified constraint
        static split(c) {
            /* DEBUG
                        console.log("split on " + c);
                        console.assert(c.active, "attempt to split on inactive constraint");
            DEBUG */
            c.active = false;
            return [Block.createSplitBlock(c.left), Block.createSplitBlock(c.right)];
        }
        static createSplitBlock(startVar) {
            var b = new Block(startVar);
            b.populateSplitBlock(startVar, null);
            return b;
        }
        // find a split point somewhere between the specified variables
        splitBetween(vl, vr) {
            /* DEBUG
                        console.assert(vl.block === this);
                        console.assert(vr.block === this);
            DEBUG */
            var c = this.findMinLMBetween(vl, vr);
            if (c !== null) {
                var bs = Block.split(c);
                return { constraint: c, lb: bs[0], rb: bs[1] };
            }
            // couldn't find a split point - for example the active path is all equality constraints
            return null;
        }
        mergeAcross(b, c, dist) {
            c.active = true;
            for (var i = 0, n = b.vars.length; i < n; ++i) {
                var v = b.vars[i];
                v.offset += dist;
                this.addVariable(v);
            }
            this.posn = this.ps.getPosn();
        }
        cost() {
            var sum = 0, i = this.vars.length;
            while (i--) {
                var v = this.vars[i], d = v.position() - v.desiredPosition;
                sum += d * d * v.weight;
            }
            return sum;
        }
    }
    exports.Block = Block;
    class Blocks {
        constructor(vs) {
            this.vs = vs;
            var n = vs.length;
            this.list = new Array(n);
            while (n--) {
                var b = new Block(vs[n]);
                this.list[n] = b;
                b.blockInd = n;
            }
        }
        cost() {
            var sum = 0, i = this.list.length;
            while (i--)
                sum += this.list[i].cost();
            return sum;
        }
        insert(b) {
            /* DEBUG
                        console.assert(!this.contains(b), "blocks error: tried to reinsert block " + b.blockInd)
            DEBUG */
            b.blockInd = this.list.length;
            this.list.push(b);
            /* DEBUG
                        console.log("insert block: " + b.blockInd);
                        this.contains(b);
            DEBUG */
        }
        remove(b) {
            /* DEBUG
                        console.log("remove block: " + b.blockInd);
                        console.assert(this.contains(b));
            DEBUG */
            var last = this.list.length - 1;
            var swapBlock = this.list[last];
            this.list.length = last;
            if (b !== swapBlock) {
                this.list[b.blockInd] = swapBlock;
                swapBlock.blockInd = b.blockInd;
            }
        }
        // merge the blocks on either side of the specified constraint, by copying the smaller block into the larger
        // and deleting the smaller.
        merge(c) {
            var l = c.left.block, r = c.right.block;
            /* DEBUG
                        console.assert(l!==r, "attempt to merge within the same block");
            DEBUG */
            var dist = c.right.offset - c.left.offset - c.gap;
            if (l.vars.length < r.vars.length) {
                r.mergeAcross(l, c, dist);
                this.remove(l);
            }
            else {
                l.mergeAcross(r, c, -dist);
                this.remove(r);
            }
            /* DEBUG
                        console.assert(Math.abs(c.slack()) < 1e-6, "Error: Constraint should be at equality after merge!");
                        console.log("merged on " + c);
            DEBUG */
        }
        forEach(f) {
            this.list.forEach(f);
        }
        // useful, for example, after variable desired positions change.
        updateBlockPositions() {
            this.list.forEach(b => b.updateWeightedPosition());
        }
        // split each block across its constraint with the minimum lagrangian
        split(inactive) {
            this.updateBlockPositions();
            this.list.forEach(b => {
                var v = b.findMinLM();
                if (v !== null && v.lm < Solver.LAGRANGIAN_TOLERANCE) {
                    b = v.left.block;
                    Block.split(v).forEach(nb => this.insert(nb));
                    this.remove(b);
                    inactive.push(v);
                }
            });
        }
    }
    exports.Blocks = Blocks;
    class Solver {
        constructor(vs, cs) {
            this.vs = vs;
            this.cs = cs;
            this.vs = vs;
            vs.forEach(v => {
                v.cIn = [], v.cOut = [];
                /* DEBUG
                                v.toString = () => "v" + vs.indexOf(v);
                DEBUG */
            });
            this.cs = cs;
            cs.forEach(c => {
                c.left.cOut.push(c);
                c.right.cIn.push(c);
                /* DEBUG
                                c.toString = () => c.left + "+" + c.gap + "<=" + c.right + " slack=" + c.slack() + " active=" + c.active;
                DEBUG */
            });
            this.inactive = cs.map(c => { c.active = false; return c; });
            this.bs = null;
        }
        cost() {
            return this.bs.cost();
        }
        // set starting positions without changing desired positions.
        // Note: it throws away any previous block structure.
        setStartingPositions(ps) {
            this.inactive = this.cs.map(c => { c.active = false; return c; });
            this.bs = new Blocks(this.vs);
            this.bs.forEach((b, i) => b.posn = ps[i]);
        }
        setDesiredPositions(ps) {
            this.vs.forEach((v, i) => v.desiredPosition = ps[i]);
        }
        /* DEBUG
                private getId(v: Variable): number {
                    return this.vs.indexOf(v);
                }
        
                // sanity check of the index integrity of the inactive list
                checkInactive(): void {
                    var inactiveCount = 0;
                    this.cs.forEach(c=> {
                        var i = this.inactive.indexOf(c);
                        console.assert(!c.active && i >= 0 || c.active && i < 0, "constraint should be in the inactive list if it is not active: " + c);
                        if (i >= 0) {
                            inactiveCount++;
                        } else {
                            console.assert(c.active, "inactive constraint not found in inactive list: " + c);
                        }
                    });
                    console.assert(inactiveCount === this.inactive.length, inactiveCount + " inactive constraints found, " + this.inactive.length + "in inactive list");
                }
                // after every call to satisfy the following should check should pass
                checkSatisfied(): void {
                    this.cs.forEach(c=>console.assert(c.slack() >= vpsc.Solver.ZERO_UPPERBOUND, "Error: Unsatisfied constraint! "+c));
                }
        DEBUG */
        mostViolated() {
            var minSlack = Number.MAX_VALUE, v = null, l = this.inactive, n = l.length, deletePoint = n;
            for (var i = 0; i < n; ++i) {
                var c = l[i];
                if (c.unsatisfiable)
                    continue;
                var slack = c.slack();
                if (c.equality || slack < minSlack) {
                    minSlack = slack;
                    v = c;
                    deletePoint = i;
                    if (c.equality)
                        break;
                }
            }
            if (deletePoint !== n &&
                (minSlack < Solver.ZERO_UPPERBOUND && !v.active || v.equality)) {
                l[deletePoint] = l[n - 1];
                l.length = n - 1;
            }
            return v;
        }
        // satisfy constraints by building block structure over violated constraints
        // and moving the blocks to their desired positions
        satisfy() {
            if (this.bs == null) {
                this.bs = new Blocks(this.vs);
            }
            /* DEBUG
                        console.log("satisfy: " + this.bs);
            DEBUG */
            this.bs.split(this.inactive);
            var v = null;
            while ((v = this.mostViolated()) && (v.equality || v.slack() < Solver.ZERO_UPPERBOUND && !v.active)) {
                var lb = v.left.block, rb = v.right.block;
                /* DEBUG
                                console.log("most violated is: " + v);
                                this.bs.contains(lb);
                                this.bs.contains(rb);
                DEBUG */
                if (lb !== rb) {
                    this.bs.merge(v);
                }
                else {
                    if (lb.isActiveDirectedPathBetween(v.right, v.left)) {
                        // cycle found!
                        v.unsatisfiable = true;
                        continue;
                    }
                    // constraint is within block, need to split first
                    var split = lb.splitBetween(v.left, v.right);
                    if (split !== null) {
                        this.bs.insert(split.lb);
                        this.bs.insert(split.rb);
                        this.bs.remove(lb);
                        this.inactive.push(split.constraint);
                    }
                    else {
                        /* DEBUG
                                                console.log("unsatisfiable constraint found");
                        DEBUG */
                        v.unsatisfiable = true;
                        continue;
                    }
                    if (v.slack() >= 0) {
                        /* DEBUG
                                                console.log("violated constraint indirectly satisfied: " + v);
                        DEBUG */
                        // v was satisfied by the above split!
                        this.inactive.push(v);
                    }
                    else {
                        /* DEBUG
                                                console.log("merge after split:");
                        DEBUG */
                        this.bs.merge(v);
                    }
                }
            }
            /* DEBUG
                        this.checkSatisfied();
            DEBUG */
        }
        // repeatedly build and split block structure until we converge to an optimal solution
        solve() {
            this.satisfy();
            var lastcost = Number.MAX_VALUE, cost = this.bs.cost();
            while (Math.abs(lastcost - cost) > 0.0001) {
                this.satisfy();
                lastcost = cost;
                cost = this.bs.cost();
            }
            return cost;
        }
    }
    Solver.LAGRANGIAN_TOLERANCE = -1e-4;
    Solver.ZERO_UPPERBOUND = -1e-10;
    exports.Solver = Solver;
    /**
      * Remove overlap between spans while keeping their centers as close as possible to the specified desiredCenters.
      * Lower and upper bounds will be respected if the spans physically fit between them
      * (otherwise they'll be moved and their new position returned).
      * If no upper/lower bound is specified then the bounds of the moved spans will be returned.
      * returns a new center for each span.
      */
    function removeOverlapInOneDimension(spans, lowerBound, upperBound) {
        const vs = spans.map(s => new Variable(s.desiredCenter));
        const cs = [];
        const n = spans.length;
        for (var i = 0; i < n - 1; i++) {
            const left = spans[i], right = spans[i + 1];
            cs.push(new Constraint(vs[i], vs[i + 1], (left.size + right.size) / 2));
        }
        const leftMost = vs[0], rightMost = vs[n - 1], leftMostSize = spans[0].size / 2, rightMostSize = spans[n - 1].size / 2;
        let vLower = null, vUpper = null;
        if (lowerBound) {
            vLower = new Variable(lowerBound, leftMost.weight * 1000);
            vs.push(vLower);
            cs.push(new Constraint(vLower, leftMost, leftMostSize));
        }
        if (upperBound) {
            vUpper = new Variable(upperBound, rightMost.weight * 1000);
            vs.push(vUpper);
            cs.push(new Constraint(rightMost, vUpper, rightMostSize));
        }
        var solver = new Solver(vs, cs);
        solver.solve();
        return {
            newCenters: vs.slice(0, spans.length).map(v => v.position()),
            lowerBound: vLower ? vLower.position() : leftMost.position() - leftMostSize,
            upperBound: vUpper ? vUpper.position() : rightMost.position() + rightMostSize
        };
    }
    exports.removeOverlapInOneDimension = removeOverlapInOneDimension;
    },{}],21:[function(require,module,exports){
    addEventListener.removeEventListener = removeEventListener
    addEventListener.addEventListener = addEventListener
    
    module.exports = addEventListener
    
    var Events = null
    
    function addEventListener(el, eventName, listener, useCapture) {
      Events = Events || (
        document.addEventListener ?
        {add: stdAttach, rm: stdDetach} :
        {add: oldIEAttach, rm: oldIEDetach}
      )
      
      return Events.add(el, eventName, listener, useCapture)
    }
    
    function removeEventListener(el, eventName, listener, useCapture) {
      Events = Events || (
        document.addEventListener ?
        {add: stdAttach, rm: stdDetach} :
        {add: oldIEAttach, rm: oldIEDetach}
      )
      
      return Events.rm(el, eventName, listener, useCapture)
    }
    
    function stdAttach(el, eventName, listener, useCapture) {
      el.addEventListener(eventName, listener, useCapture)
    }
    
    function stdDetach(el, eventName, listener, useCapture) {
      el.removeEventListener(eventName, listener, useCapture)
    }
    
    function oldIEAttach(el, eventName, listener, useCapture) {
      if(useCapture) {
        throw new Error('cannot useCapture in oldIE')
      }
    
      el.attachEvent('on' + eventName, listener)
    }
    
    function oldIEDetach(el, eventName, listener, useCapture) {
      el.detachEvent('on' + eventName, listener)
    }
    
    },{}],22:[function(require,module,exports){
    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    
    function EventEmitter() {
      this._events = this._events || {};
      this._maxListeners = this._maxListeners || undefined;
    }
    module.exports = EventEmitter;
    
    // Backwards-compat with node 0.10.x
    EventEmitter.EventEmitter = EventEmitter;
    
    EventEmitter.prototype._events = undefined;
    EventEmitter.prototype._maxListeners = undefined;
    
    // By default EventEmitters will print a warning if more than 10 listeners are
    // added to it. This is a useful default which helps finding memory leaks.
    EventEmitter.defaultMaxListeners = 10;
    
    // Obviously not all Emitters should be limited to 10. This function allows
    // that to be increased. Set to zero for unlimited.
    EventEmitter.prototype.setMaxListeners = function(n) {
      if (!isNumber(n) || n < 0 || isNaN(n))
        throw TypeError('n must be a positive number');
      this._maxListeners = n;
      return this;
    };
    
    EventEmitter.prototype.emit = function(type) {
      var er, handler, len, args, i, listeners;
    
      if (!this._events)
        this._events = {};
    
      // If there is no 'error' event listener then throw.
      if (type === 'error') {
        if (!this._events.error ||
            (isObject(this._events.error) && !this._events.error.length)) {
          er = arguments[1];
          if (er instanceof Error) {
            throw er; // Unhandled 'error' event
          } else {
            // At least give some kind of context to the user
            var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
            err.context = er;
            throw err;
          }
        }
      }
    
      handler = this._events[type];
    
      if (isUndefined(handler))
        return false;
    
      if (isFunction(handler)) {
        switch (arguments.length) {
          // fast cases
          case 1:
            handler.call(this);
            break;
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            args = Array.prototype.slice.call(arguments, 1);
            handler.apply(this, args);
        }
      } else if (isObject(handler)) {
        args = Array.prototype.slice.call(arguments, 1);
        listeners = handler.slice();
        len = listeners.length;
        for (i = 0; i < len; i++)
          listeners[i].apply(this, args);
      }
    
      return true;
    };
    
    EventEmitter.prototype.addListener = function(type, listener) {
      var m;
    
      if (!isFunction(listener))
        throw TypeError('listener must be a function');
    
      if (!this._events)
        this._events = {};
    
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (this._events.newListener)
        this.emit('newListener', type,
                  isFunction(listener.listener) ?
                  listener.listener : listener);
    
      if (!this._events[type])
        // Optimize the case of one listener. Don't need the extra array object.
        this._events[type] = listener;
      else if (isObject(this._events[type]))
        // If we've already got an array, just append.
        this._events[type].push(listener);
      else
        // Adding the second element, need to change to array.
        this._events[type] = [this._events[type], listener];
    
      // Check for listener leak
      if (isObject(this._events[type]) && !this._events[type].warned) {
        if (!isUndefined(this._maxListeners)) {
          m = this._maxListeners;
        } else {
          m = EventEmitter.defaultMaxListeners;
        }
    
        if (m && m > 0 && this._events[type].length > m) {
          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          if (typeof console.trace === 'function') {
            // not supported in IE 10
            console.trace();
          }
        }
      }
    
      return this;
    };
    
    EventEmitter.prototype.on = EventEmitter.prototype.addListener;
    
    EventEmitter.prototype.once = function(type, listener) {
      if (!isFunction(listener))
        throw TypeError('listener must be a function');
    
      var fired = false;
    
      function g() {
        this.removeListener(type, g);
    
        if (!fired) {
          fired = true;
          listener.apply(this, arguments);
        }
      }
    
      g.listener = listener;
      this.on(type, g);
    
      return this;
    };
    
    // emits a 'removeListener' event iff the listener was removed
    EventEmitter.prototype.removeListener = function(type, listener) {
      var list, position, length, i;
    
      if (!isFunction(listener))
        throw TypeError('listener must be a function');
    
      if (!this._events || !this._events[type])
        return this;
    
      list = this._events[type];
      length = list.length;
      position = -1;
    
      if (list === listener ||
          (isFunction(list.listener) && list.listener === listener)) {
        delete this._events[type];
        if (this._events.removeListener)
          this.emit('removeListener', type, listener);
    
      } else if (isObject(list)) {
        for (i = length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            position = i;
            break;
          }
        }
    
        if (position < 0)
          return this;
    
        if (list.length === 1) {
          list.length = 0;
          delete this._events[type];
        } else {
          list.splice(position, 1);
        }
    
        if (this._events.removeListener)
          this.emit('removeListener', type, listener);
      }
    
      return this;
    };
    
    EventEmitter.prototype.removeAllListeners = function(type) {
      var key, listeners;
    
      if (!this._events)
        return this;
    
      // not listening for removeListener, no need to emit
      if (!this._events.removeListener) {
        if (arguments.length === 0)
          this._events = {};
        else if (this._events[type])
          delete this._events[type];
        return this;
      }
    
      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        for (key in this._events) {
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = {};
        return this;
      }
    
      listeners = this._events[type];
    
      if (isFunction(listeners)) {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        while (listeners.length)
          this.removeListener(type, listeners[listeners.length - 1]);
      }
      delete this._events[type];
    
      return this;
    };
    
    EventEmitter.prototype.listeners = function(type) {
      var ret;
      if (!this._events || !this._events[type])
        ret = [];
      else if (isFunction(this._events[type]))
        ret = [this._events[type]];
      else
        ret = this._events[type].slice();
      return ret;
    };
    
    EventEmitter.prototype.listenerCount = function(type) {
      if (this._events) {
        var evlistener = this._events[type];
    
        if (isFunction(evlistener))
          return 1;
        else if (evlistener)
          return evlistener.length;
      }
      return 0;
    };
    
    EventEmitter.listenerCount = function(emitter, type) {
      return emitter.listenerCount(type);
    };
    
    function isFunction(arg) {
      return typeof arg === 'function';
    }
    
    function isNumber(arg) {
      return typeof arg === 'number';
    }
    
    function isObject(arg) {
      return typeof arg === 'object' && arg !== null;
    }
    
    function isUndefined(arg) {
      return arg === void 0;
    }
    
    },{}],23:[function(require,module,exports){
    module.exports = fullscreen
    fullscreen.available = available
    fullscreen.enabled = enabled
    
    var EE = require('events').EventEmitter
    var ael = require('add-event-listener')
    var rel = ael.removeEventListener
    
    function available() {
      return !!shim(document.body)
    }
    
    function enabled() {
      return !!(document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.mozFullscreenEnabled ||
        document.msFullscreenEnabled);
    }
    
    function fullscreen(el) {
      var doc = el.ownerDocument
        , body = doc.body
        , rfs = shim(el)
        , ee = new EE
    
      var vendors = ['', 'webkit', 'moz']
    
      for(var i = 0, len = vendors.length; i < len; ++i) {
        ael(doc, vendors[i] + 'fullscreenchange', onfullscreenchange)
        ael(doc, vendors[i] + 'fullscreenerror', onfullscreenerror)
      }
      // MS uses different casing:
      ael(doc, 'MSFullscreenChange', onfullscreenchange)
      ael(doc, 'MSFullscreenError', onfullscreenerror)
    
      ee.release = release
      ee.request = request
      ee.dispose = dispose
      ee.target = fullscreenelement
    
      if(!shim) {
        setTimeout(function() {
          ee.emit('error', new Error('fullscreen is not supported'))
        }, 0)
      }
      return ee
    
      function onfullscreenchange() {
        if(!fullscreenelement()) {
          return ee.emit('release')
        }
        ee.emit('attain')
      }
    
      function onfullscreenerror() {
        ee.emit('error')
      }
    
      function request() {
        return rfs.apply(el, arguments)
      }
    
      function release() {
    
        var element_exit = (el.exitFullscreen ||
          el.webkitExitFullscreen ||
          el.mozCancelFullScreen ||
          el.mozExitFullScreen ||
          el.msExitFullscreen);
    
        if (element_exit) {
          element_exit.apply(el, arguments);
          return;
        }
    
        var document_exit = (doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.mozExitFullScreen ||
          doc.msExitFullscreen);
    
        document_exit.apply(doc, arguments);
      } 
    
      function fullscreenelement() {
        return (0 ||
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement ||
          null);
      }
    
      function dispose() {
        for(var i = 0, len = vendors.length; i < len; ++i) {
          rel(doc, vendors[i] + 'fullscreenchange', onfullscreenchange)
          rel(doc, vendors[i] + 'fullscreenerror', onfullscreenerror)
        }
        // MS uses different casing:
        rel(doc, 'MSFullscreenChange', onfullscreenchange)
        rel(doc, 'MSFullscreenError', onfullscreenerror)
      }
    }
    
    function shim(el) {
      return (el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen);
    }
    
    },{"add-event-listener":21,"events":22}],24:[function(require,module,exports){
    /*!
     * jQuery JavaScript Library v3.1.1
     * https://jquery.com/
     *
     * Includes Sizzle.js
     * https://sizzlejs.com/
     *
     * Copyright jQuery Foundation and other contributors
     * Released under the MIT license
     * https://jquery.org/license
     *
     * Date: 2016-09-22T22:30Z
     */
    ( function( global, factory ) {
    
        "use strict";
    
        if ( typeof module === "object" && typeof module.exports === "object" ) {
    
            // For CommonJS and CommonJS-like environments where a proper `window`
            // is present, execute the factory and get jQuery.
            // For environments that do not have a `window` with a `document`
            // (such as Node.js), expose a factory as module.exports.
            // This accentuates the need for the creation of a real `window`.
            // e.g. var jQuery = require("jquery")(window);
            // See ticket #14549 for more info.
            module.exports = global.document ?
                factory( global, true ) :
                function( w ) {
                    if ( !w.document ) {
                        throw new Error( "jQuery requires a window with a document" );
                    }
                    return factory( w );
                };
        } else {
            factory( global );
        }
    
    // Pass this if window is not defined yet
    } )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {
    
    // Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
    // throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
    // arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
    // enough that all such attempts are guarded in a try block.
    "use strict";
    
    var arr = [];
    
    var document = window.document;
    
    var getProto = Object.getPrototypeOf;
    
    var slice = arr.slice;
    
    var concat = arr.concat;
    
    var push = arr.push;
    
    var indexOf = arr.indexOf;
    
    var class2type = {};
    
    var toString = class2type.toString;
    
    var hasOwn = class2type.hasOwnProperty;
    
    var fnToString = hasOwn.toString;
    
    var ObjectFunctionString = fnToString.call( Object );
    
    var support = {};
    
    
    
        function DOMEval( code, doc ) {
            doc = doc || document;
    
            var script = doc.createElement( "script" );
    
            script.text = code;
            doc.head.appendChild( script ).parentNode.removeChild( script );
        }
    /* global Symbol */
    // Defining this global in .eslintrc.json would create a danger of using the global
    // unguarded in another place, it seems safer to define global only for this module
    
    
    
    var
        version = "3.1.1",
    
        // Define a local copy of jQuery
        jQuery = function( selector, context ) {
    
            // The jQuery object is actually just the init constructor 'enhanced'
            // Need init if jQuery is called (just allow error to be thrown if not included)
            return new jQuery.fn.init( selector, context );
        },
    
        // Support: Android <=4.0 only
        // Make sure we trim BOM and NBSP
        rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,
    
        // Matches dashed string for camelizing
        rmsPrefix = /^-ms-/,
        rdashAlpha = /-([a-z])/g,
    
        // Used by jQuery.camelCase as callback to replace()
        fcamelCase = function( all, letter ) {
            return letter.toUpperCase();
        };
    
    jQuery.fn = jQuery.prototype = {
    
        // The current version of jQuery being used
        jquery: version,
    
        constructor: jQuery,
    
        // The default length of a jQuery object is 0
        length: 0,
    
        toArray: function() {
            return slice.call( this );
        },
    
        // Get the Nth element in the matched element set OR
        // Get the whole matched element set as a clean array
        get: function( num ) {
    
            // Return all the elements in a clean array
            if ( num == null ) {
                return slice.call( this );
            }
    
            // Return just the one element from the set
            return num < 0 ? this[ num + this.length ] : this[ num ];
        },
    
        // Take an array of elements and push it onto the stack
        // (returning the new matched element set)
        pushStack: function( elems ) {
    
            // Build a new jQuery matched element set
            var ret = jQuery.merge( this.constructor(), elems );
    
            // Add the old object onto the stack (as a reference)
            ret.prevObject = this;
    
            // Return the newly-formed element set
            return ret;
        },
    
        // Execute a callback for every element in the matched set.
        each: function( callback ) {
            return jQuery.each( this, callback );
        },
    
        map: function( callback ) {
            return this.pushStack( jQuery.map( this, function( elem, i ) {
                return callback.call( elem, i, elem );
            } ) );
        },
    
        slice: function() {
            return this.pushStack( slice.apply( this, arguments ) );
        },
    
        first: function() {
            return this.eq( 0 );
        },
    
        last: function() {
            return this.eq( -1 );
        },
    
        eq: function( i ) {
            var len = this.length,
                j = +i + ( i < 0 ? len : 0 );
            return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
        },
    
        end: function() {
            return this.prevObject || this.constructor();
        },
    
        // For internal use only.
        // Behaves like an Array's method, not like a jQuery method.
        push: push,
        sort: arr.sort,
        splice: arr.splice
    };
    
    jQuery.extend = jQuery.fn.extend = function() {
        var options, name, src, copy, copyIsArray, clone,
            target = arguments[ 0 ] || {},
            i = 1,
            length = arguments.length,
            deep = false;
    
        // Handle a deep copy situation
        if ( typeof target === "boolean" ) {
            deep = target;
    
            // Skip the boolean and the target
            target = arguments[ i ] || {};
            i++;
        }
    
        // Handle case when target is a string or something (possible in deep copy)
        if ( typeof target !== "object" && !jQuery.isFunction( target ) ) {
            target = {};
        }
    
        // Extend jQuery itself if only one argument is passed
        if ( i === length ) {
            target = this;
            i--;
        }
    
        for ( ; i < length; i++ ) {
    
            // Only deal with non-null/undefined values
            if ( ( options = arguments[ i ] ) != null ) {
    
                // Extend the base object
                for ( name in options ) {
                    src = target[ name ];
                    copy = options[ name ];
    
                    // Prevent never-ending loop
                    if ( target === copy ) {
                        continue;
                    }
    
                    // Recurse if we're merging plain objects or arrays
                    if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
                        ( copyIsArray = jQuery.isArray( copy ) ) ) ) {
    
                        if ( copyIsArray ) {
                            copyIsArray = false;
                            clone = src && jQuery.isArray( src ) ? src : [];
    
                        } else {
                            clone = src && jQuery.isPlainObject( src ) ? src : {};
                        }
    
                        // Never move original objects, clone them
                        target[ name ] = jQuery.extend( deep, clone, copy );
    
                    // Don't bring in undefined values
                    } else if ( copy !== undefined ) {
                        target[ name ] = copy;
                    }
                }
            }
        }
    
        // Return the modified object
        return target;
    };
    
    jQuery.extend( {
    
        // Unique for each copy of jQuery on the page
        expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),
    
        // Assume jQuery is ready without the ready module
        isReady: true,
    
        error: function( msg ) {
            throw new Error( msg );
        },
    
        noop: function() {},
    
        isFunction: function( obj ) {
            return jQuery.type( obj ) === "function";
        },
    
        isArray: Array.isArray,
    
        isWindow: function( obj ) {
            return obj != null && obj === obj.window;
        },
    
        isNumeric: function( obj ) {
    
            // As of jQuery 3.0, isNumeric is limited to
            // strings and numbers (primitives or objects)
            // that can be coerced to finite numbers (gh-2662)
            var type = jQuery.type( obj );
            return ( type === "number" || type === "string" ) &&
    
                // parseFloat NaNs numeric-cast false positives ("")
                // ...but misinterprets leading-number strings, particularly hex literals ("0x...")
                // subtraction forces infinities to NaN
                !isNaN( obj - parseFloat( obj ) );
        },
    
        isPlainObject: function( obj ) {
            var proto, Ctor;
    
            // Detect obvious negatives
            // Use toString instead of jQuery.type to catch host objects
            if ( !obj || toString.call( obj ) !== "[object Object]" ) {
                return false;
            }
    
            proto = getProto( obj );
    
            // Objects with no prototype (e.g., `Object.create( null )`) are plain
            if ( !proto ) {
                return true;
            }
    
            // Objects with prototype are plain iff they were constructed by a global Object function
            Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
            return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
        },
    
        isEmptyObject: function( obj ) {
    
            /* eslint-disable no-unused-vars */
            // See https://github.com/eslint/eslint/issues/6125
            var name;
    
            for ( name in obj ) {
                return false;
            }
            return true;
        },
    
        type: function( obj ) {
            if ( obj == null ) {
                return obj + "";
            }
    
            // Support: Android <=2.3 only (functionish RegExp)
            return typeof obj === "object" || typeof obj === "function" ?
                class2type[ toString.call( obj ) ] || "object" :
                typeof obj;
        },
    
        // Evaluates a script in a global context
        globalEval: function( code ) {
            DOMEval( code );
        },
    
        // Convert dashed to camelCase; used by the css and data modules
        // Support: IE <=9 - 11, Edge 12 - 13
        // Microsoft forgot to hump their vendor prefix (#9572)
        camelCase: function( string ) {
            return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
        },
    
        nodeName: function( elem, name ) {
            return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
        },
    
        each: function( obj, callback ) {
            var length, i = 0;
    
            if ( isArrayLike( obj ) ) {
                length = obj.length;
                for ( ; i < length; i++ ) {
                    if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
                        break;
                    }
                }
            } else {
                for ( i in obj ) {
                    if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
                        break;
                    }
                }
            }
    
            return obj;
        },
    
        // Support: Android <=4.0 only
        trim: function( text ) {
            return text == null ?
                "" :
                ( text + "" ).replace( rtrim, "" );
        },
    
        // results is for internal usage only
        makeArray: function( arr, results ) {
            var ret = results || [];
    
            if ( arr != null ) {
                if ( isArrayLike( Object( arr ) ) ) {
                    jQuery.merge( ret,
                        typeof arr === "string" ?
                        [ arr ] : arr
                    );
                } else {
                    push.call( ret, arr );
                }
            }
    
            return ret;
        },
    
        inArray: function( elem, arr, i ) {
            return arr == null ? -1 : indexOf.call( arr, elem, i );
        },
    
        // Support: Android <=4.0 only, PhantomJS 1 only
        // push.apply(_, arraylike) throws on ancient WebKit
        merge: function( first, second ) {
            var len = +second.length,
                j = 0,
                i = first.length;
    
            for ( ; j < len; j++ ) {
                first[ i++ ] = second[ j ];
            }
    
            first.length = i;
    
            return first;
        },
    
        grep: function( elems, callback, invert ) {
            var callbackInverse,
                matches = [],
                i = 0,
                length = elems.length,
                callbackExpect = !invert;
    
            // Go through the array, only saving the items
            // that pass the validator function
            for ( ; i < length; i++ ) {
                callbackInverse = !callback( elems[ i ], i );
                if ( callbackInverse !== callbackExpect ) {
                    matches.push( elems[ i ] );
                }
            }
    
            return matches;
        },
    
        // arg is for internal usage only
        map: function( elems, callback, arg ) {
            var length, value,
                i = 0,
                ret = [];
    
            // Go through the array, translating each of the items to their new values
            if ( isArrayLike( elems ) ) {
                length = elems.length;
                for ( ; i < length; i++ ) {
                    value = callback( elems[ i ], i, arg );
    
                    if ( value != null ) {
                        ret.push( value );
                    }
                }
    
            // Go through every key on the object,
            } else {
                for ( i in elems ) {
                    value = callback( elems[ i ], i, arg );
    
                    if ( value != null ) {
                        ret.push( value );
                    }
                }
            }
    
            // Flatten any nested arrays
            return concat.apply( [], ret );
        },
    
        // A global GUID counter for objects
        guid: 1,
    
        // Bind a function to a context, optionally partially applying any
        // arguments.
        proxy: function( fn, context ) {
            var tmp, args, proxy;
    
            if ( typeof context === "string" ) {
                tmp = fn[ context ];
                context = fn;
                fn = tmp;
            }
    
            // Quick check to determine if target is callable, in the spec
            // this throws a TypeError, but we will just return undefined.
            if ( !jQuery.isFunction( fn ) ) {
                return undefined;
            }
    
            // Simulated bind
            args = slice.call( arguments, 2 );
            proxy = function() {
                return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
            };
    
            // Set the guid of unique handler to the same of original handler, so it can be removed
            proxy.guid = fn.guid = fn.guid || jQuery.guid++;
    
            return proxy;
        },
    
        now: Date.now,
    
        // jQuery.support is not used in Core but other projects attach their
        // properties to it so it needs to exist.
        support: support
    } );
    
    if ( typeof Symbol === "function" ) {
        jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
    }
    
    // Populate the class2type map
    jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
    function( i, name ) {
        class2type[ "[object " + name + "]" ] = name.toLowerCase();
    } );
    
    function isArrayLike( obj ) {
    
        // Support: real iOS 8.2 only (not reproducible in simulator)
        // `in` check used to prevent JIT error (gh-2145)
        // hasOwn isn't used here due to false negatives
        // regarding Nodelist length in IE
        var length = !!obj && "length" in obj && obj.length,
            type = jQuery.type( obj );
    
        if ( type === "function" || jQuery.isWindow( obj ) ) {
            return false;
        }
    
        return type === "array" || length === 0 ||
            typeof length === "number" && length > 0 && ( length - 1 ) in obj;
    }
    var Sizzle =
    /*!
     * Sizzle CSS Selector Engine v2.3.3
     * https://sizzlejs.com/
     *
     * Copyright jQuery Foundation and other contributors
     * Released under the MIT license
     * http://jquery.org/license
     *
     * Date: 2016-08-08
     */
    (function( window ) {
    
    var i,
        support,
        Expr,
        getText,
        isXML,
        tokenize,
        compile,
        select,
        outermostContext,
        sortInput,
        hasDuplicate,
    
        // Local document vars
        setDocument,
        document,
        docElem,
        documentIsHTML,
        rbuggyQSA,
        rbuggyMatches,
        matches,
        contains,
    
        // Instance-specific data
        expando = "sizzle" + 1 * new Date(),
        preferredDoc = window.document,
        dirruns = 0,
        done = 0,
        classCache = createCache(),
        tokenCache = createCache(),
        compilerCache = createCache(),
        sortOrder = function( a, b ) {
            if ( a === b ) {
                hasDuplicate = true;
            }
            return 0;
        },
    
        // Instance methods
        hasOwn = ({}).hasOwnProperty,
        arr = [],
        pop = arr.pop,
        push_native = arr.push,
        push = arr.push,
        slice = arr.slice,
        // Use a stripped-down indexOf as it's faster than native
        // https://jsperf.com/thor-indexof-vs-for/5
        indexOf = function( list, elem ) {
            var i = 0,
                len = list.length;
            for ( ; i < len; i++ ) {
                if ( list[i] === elem ) {
                    return i;
                }
            }
            return -1;
        },
    
        booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
    
        // Regular expressions
    
        // http://www.w3.org/TR/css3-selectors/#whitespace
        whitespace = "[\\x20\\t\\r\\n\\f]",
    
        // http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
        identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",
    
        // Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
        attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
            // Operator (capture 2)
            "*([*^$|!~]?=)" + whitespace +
            // "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
            "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
            "*\\]",
    
        pseudos = ":(" + identifier + ")(?:\\((" +
            // To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
            // 1. quoted (capture 3; capture 4 or capture 5)
            "('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
            // 2. simple (capture 6)
            "((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
            // 3. anything else (capture 2)
            ".*" +
            ")\\)|)",
    
        // Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
        rwhitespace = new RegExp( whitespace + "+", "g" ),
        rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),
    
        rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
        rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),
    
        rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),
    
        rpseudo = new RegExp( pseudos ),
        ridentifier = new RegExp( "^" + identifier + "$" ),
    
        matchExpr = {
            "ID": new RegExp( "^#(" + identifier + ")" ),
            "CLASS": new RegExp( "^\\.(" + identifier + ")" ),
            "TAG": new RegExp( "^(" + identifier + "|[*])" ),
            "ATTR": new RegExp( "^" + attributes ),
            "PSEUDO": new RegExp( "^" + pseudos ),
            "CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
                "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
                "*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
            "bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
            // For use in libraries implementing .is()
            // We use this for POS matching in `select`
            "needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
                whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
        },
    
        rinputs = /^(?:input|select|textarea|button)$/i,
        rheader = /^h\d$/i,
    
        rnative = /^[^{]+\{\s*\[native \w/,
    
        // Easily-parseable/retrievable ID or TAG or CLASS selectors
        rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
    
        rsibling = /[+~]/,
    
        // CSS escapes
        // http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
        runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
        funescape = function( _, escaped, escapedWhitespace ) {
            var high = "0x" + escaped - 0x10000;
            // NaN means non-codepoint
            // Support: Firefox<24
            // Workaround erroneous numeric interpretation of +"0x"
            return high !== high || escapedWhitespace ?
                escaped :
                high < 0 ?
                    // BMP codepoint
                    String.fromCharCode( high + 0x10000 ) :
                    // Supplemental Plane codepoint (surrogate pair)
                    String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
        },
    
        // CSS string/identifier serialization
        // https://drafts.csswg.org/cssom/#common-serializing-idioms
        rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
        fcssescape = function( ch, asCodePoint ) {
            if ( asCodePoint ) {
    
                // U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
                if ( ch === "\0" ) {
                    return "\uFFFD";
                }
    
                // Control characters and (dependent upon position) numbers get escaped as code points
                return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
            }
    
            // Other potentially-special ASCII characters get backslash-escaped
            return "\\" + ch;
        },
    
        // Used for iframes
        // See setDocument()
        // Removing the function wrapper causes a "Permission Denied"
        // error in IE
        unloadHandler = function() {
            setDocument();
        },
    
        disabledAncestor = addCombinator(
            function( elem ) {
                return elem.disabled === true && ("form" in elem || "label" in elem);
            },
            { dir: "parentNode", next: "legend" }
        );
    
    // Optimize for push.apply( _, NodeList )
    try {
        push.apply(
            (arr = slice.call( preferredDoc.childNodes )),
            preferredDoc.childNodes
        );
        // Support: Android<4.0
        // Detect silently failing push.apply
        arr[ preferredDoc.childNodes.length ].nodeType;
    } catch ( e ) {
        push = { apply: arr.length ?
    
            // Leverage slice if possible
            function( target, els ) {
                push_native.apply( target, slice.call(els) );
            } :
    
            // Support: IE<9
            // Otherwise append directly
            function( target, els ) {
                var j = target.length,
                    i = 0;
                // Can't trust NodeList.length
                while ( (target[j++] = els[i++]) ) {}
                target.length = j - 1;
            }
        };
    }
    
    function Sizzle( selector, context, results, seed ) {
        var m, i, elem, nid, match, groups, newSelector,
            newContext = context && context.ownerDocument,
    
            // nodeType defaults to 9, since context defaults to document
            nodeType = context ? context.nodeType : 9;
    
        results = results || [];
    
        // Return early from calls with invalid selector or context
        if ( typeof selector !== "string" || !selector ||
            nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {
    
            return results;
        }
    
        // Try to shortcut find operations (as opposed to filters) in HTML documents
        if ( !seed ) {
    
            if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
                setDocument( context );
            }
            context = context || document;
    
            if ( documentIsHTML ) {
    
                // If the selector is sufficiently simple, try using a "get*By*" DOM method
                // (excepting DocumentFragment context, where the methods don't exist)
                if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {
    
                    // ID selector
                    if ( (m = match[1]) ) {
    
                        // Document context
                        if ( nodeType === 9 ) {
                            if ( (elem = context.getElementById( m )) ) {
    
                                // Support: IE, Opera, Webkit
                                // TODO: identify versions
                                // getElementById can match elements by name instead of ID
                                if ( elem.id === m ) {
                                    results.push( elem );
                                    return results;
                                }
                            } else {
                                return results;
                            }
    
                        // Element context
                        } else {
    
                            // Support: IE, Opera, Webkit
                            // TODO: identify versions
                            // getElementById can match elements by name instead of ID
                            if ( newContext && (elem = newContext.getElementById( m )) &&
                                contains( context, elem ) &&
                                elem.id === m ) {
    
                                results.push( elem );
                                return results;
                            }
                        }
    
                    // Type selector
                    } else if ( match[2] ) {
                        push.apply( results, context.getElementsByTagName( selector ) );
                        return results;
    
                    // Class selector
                    } else if ( (m = match[3]) && support.getElementsByClassName &&
                        context.getElementsByClassName ) {
    
                        push.apply( results, context.getElementsByClassName( m ) );
                        return results;
                    }
                }
    
                // Take advantage of querySelectorAll
                if ( support.qsa &&
                    !compilerCache[ selector + " " ] &&
                    (!rbuggyQSA || !rbuggyQSA.test( selector )) ) {
    
                    if ( nodeType !== 1 ) {
                        newContext = context;
                        newSelector = selector;
    
                    // qSA looks outside Element context, which is not what we want
                    // Thanks to Andrew Dupont for this workaround technique
                    // Support: IE <=8
                    // Exclude object elements
                    } else if ( context.nodeName.toLowerCase() !== "object" ) {
    
                        // Capture the context ID, setting it first if necessary
                        if ( (nid = context.getAttribute( "id" )) ) {
                            nid = nid.replace( rcssescape, fcssescape );
                        } else {
                            context.setAttribute( "id", (nid = expando) );
                        }
    
                        // Prefix every selector in the list
                        groups = tokenize( selector );
                        i = groups.length;
                        while ( i-- ) {
                            groups[i] = "#" + nid + " " + toSelector( groups[i] );
                        }
                        newSelector = groups.join( "," );
    
                        // Expand context for sibling selectors
                        newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
                            context;
                    }
    
                    if ( newSelector ) {
                        try {
                            push.apply( results,
                                newContext.querySelectorAll( newSelector )
                            );
                            return results;
                        } catch ( qsaError ) {
                        } finally {
                            if ( nid === expando ) {
                                context.removeAttribute( "id" );
                            }
                        }
                    }
                }
            }
        }
    
        // All others
        return select( selector.replace( rtrim, "$1" ), context, results, seed );
    }
    
    /**
     * Create key-value caches of limited size
     * @returns {function(string, object)} Returns the Object data after storing it on itself with
     *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
     *	deleting the oldest entry
     */
    function createCache() {
        var keys = [];
    
        function cache( key, value ) {
            // Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
            if ( keys.push( key + " " ) > Expr.cacheLength ) {
                // Only keep the most recent entries
                delete cache[ keys.shift() ];
            }
            return (cache[ key + " " ] = value);
        }
        return cache;
    }
    
    /**
     * Mark a function for special use by Sizzle
     * @param {Function} fn The function to mark
     */
    function markFunction( fn ) {
        fn[ expando ] = true;
        return fn;
    }
    
    /**
     * Support testing using an element
     * @param {Function} fn Passed the created element and returns a boolean result
     */
    function assert( fn ) {
        var el = document.createElement("fieldset");
    
        try {
            return !!fn( el );
        } catch (e) {
            return false;
        } finally {
            // Remove from its parent by default
            if ( el.parentNode ) {
                el.parentNode.removeChild( el );
            }
            // release memory in IE
            el = null;
        }
    }
    
    /**
     * Adds the same handler for all of the specified attrs
     * @param {String} attrs Pipe-separated list of attributes
     * @param {Function} handler The method that will be applied
     */
    function addHandle( attrs, handler ) {
        var arr = attrs.split("|"),
            i = arr.length;
    
        while ( i-- ) {
            Expr.attrHandle[ arr[i] ] = handler;
        }
    }
    
    /**
     * Checks document order of two siblings
     * @param {Element} a
     * @param {Element} b
     * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
     */
    function siblingCheck( a, b ) {
        var cur = b && a,
            diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
                a.sourceIndex - b.sourceIndex;
    
        // Use IE sourceIndex if available on both nodes
        if ( diff ) {
            return diff;
        }
    
        // Check if b follows a
        if ( cur ) {
            while ( (cur = cur.nextSibling) ) {
                if ( cur === b ) {
                    return -1;
                }
            }
        }
    
        return a ? 1 : -1;
    }
    
    /**
     * Returns a function to use in pseudos for input types
     * @param {String} type
     */
    function createInputPseudo( type ) {
        return function( elem ) {
            var name = elem.nodeName.toLowerCase();
            return name === "input" && elem.type === type;
        };
    }
    
    /**
     * Returns a function to use in pseudos for buttons
     * @param {String} type
     */
    function createButtonPseudo( type ) {
        return function( elem ) {
            var name = elem.nodeName.toLowerCase();
            return (name === "input" || name === "button") && elem.type === type;
        };
    }
    
    /**
     * Returns a function to use in pseudos for :enabled/:disabled
     * @param {Boolean} disabled true for :disabled; false for :enabled
     */
    function createDisabledPseudo( disabled ) {
    
        // Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
        return function( elem ) {
    
            // Only certain elements can match :enabled or :disabled
            // https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
            // https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
            if ( "form" in elem ) {
    
                // Check for inherited disabledness on relevant non-disabled elements:
                // * listed form-associated elements in a disabled fieldset
                //   https://html.spec.whatwg.org/multipage/forms.html#category-listed
                //   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
                // * option elements in a disabled optgroup
                //   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
                // All such elements have a "form" property.
                if ( elem.parentNode && elem.disabled === false ) {
    
                    // Option elements defer to a parent optgroup if present
                    if ( "label" in elem ) {
                        if ( "label" in elem.parentNode ) {
                            return elem.parentNode.disabled === disabled;
                        } else {
                            return elem.disabled === disabled;
                        }
                    }
    
                    // Support: IE 6 - 11
                    // Use the isDisabled shortcut property to check for disabled fieldset ancestors
                    return elem.isDisabled === disabled ||
    
                        // Where there is no isDisabled, check manually
                        /* jshint -W018 */
                        elem.isDisabled !== !disabled &&
                            disabledAncestor( elem ) === disabled;
                }
    
                return elem.disabled === disabled;
    
            // Try to winnow out elements that can't be disabled before trusting the disabled property.
            // Some victims get caught in our net (label, legend, menu, track), but it shouldn't
            // even exist on them, let alone have a boolean value.
            } else if ( "label" in elem ) {
                return elem.disabled === disabled;
            }
    
            // Remaining elements are neither :enabled nor :disabled
            return false;
        };
    }
    
    /**
     * Returns a function to use in pseudos for positionals
     * @param {Function} fn
     */
    function createPositionalPseudo( fn ) {
        return markFunction(function( argument ) {
            argument = +argument;
            return markFunction(function( seed, matches ) {
                var j,
                    matchIndexes = fn( [], seed.length, argument ),
                    i = matchIndexes.length;
    
                // Match elements found at the specified indexes
                while ( i-- ) {
                    if ( seed[ (j = matchIndexes[i]) ] ) {
                        seed[j] = !(matches[j] = seed[j]);
                    }
                }
            });
        });
    }
    
    /**
     * Checks a node for validity as a Sizzle context
     * @param {Element|Object=} context
     * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
     */
    function testContext( context ) {
        return context && typeof context.getElementsByTagName !== "undefined" && context;
    }
    
    // Expose support vars for convenience
    support = Sizzle.support = {};
    
    /**
     * Detects XML nodes
     * @param {Element|Object} elem An element or a document
     * @returns {Boolean} True iff elem is a non-HTML XML node
     */
    isXML = Sizzle.isXML = function( elem ) {
        // documentElement is verified for cases where it doesn't yet exist
        // (such as loading iframes in IE - #4833)
        var documentElement = elem && (elem.ownerDocument || elem).documentElement;
        return documentElement ? documentElement.nodeName !== "HTML" : false;
    };
    
    /**
     * Sets document-related variables once based on the current document
     * @param {Element|Object} [doc] An element or document object to use to set the document
     * @returns {Object} Returns the current document
     */
    setDocument = Sizzle.setDocument = function( node ) {
        var hasCompare, subWindow,
            doc = node ? node.ownerDocument || node : preferredDoc;
    
        // Return early if doc is invalid or already selected
        if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
            return document;
        }
    
        // Update global variables
        document = doc;
        docElem = document.documentElement;
        documentIsHTML = !isXML( document );
    
        // Support: IE 9-11, Edge
        // Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
        if ( preferredDoc !== document &&
            (subWindow = document.defaultView) && subWindow.top !== subWindow ) {
    
            // Support: IE 11, Edge
            if ( subWindow.addEventListener ) {
                subWindow.addEventListener( "unload", unloadHandler, false );
    
            // Support: IE 9 - 10 only
            } else if ( subWindow.attachEvent ) {
                subWindow.attachEvent( "onunload", unloadHandler );
            }
        }
    
        /* Attributes
        ---------------------------------------------------------------------- */
    
        // Support: IE<8
        // Verify that getAttribute really returns attributes and not properties
        // (excepting IE8 booleans)
        support.attributes = assert(function( el ) {
            el.className = "i";
            return !el.getAttribute("className");
        });
    
        /* getElement(s)By*
        ---------------------------------------------------------------------- */
    
        // Check if getElementsByTagName("*") returns only elements
        support.getElementsByTagName = assert(function( el ) {
            el.appendChild( document.createComment("") );
            return !el.getElementsByTagName("*").length;
        });
    
        // Support: IE<9
        support.getElementsByClassName = rnative.test( document.getElementsByClassName );
    
        // Support: IE<10
        // Check if getElementById returns elements by name
        // The broken getElementById methods don't pick up programmatically-set names,
        // so use a roundabout getElementsByName test
        support.getById = assert(function( el ) {
            docElem.appendChild( el ).id = expando;
            return !document.getElementsByName || !document.getElementsByName( expando ).length;
        });
    
        // ID filter and find
        if ( support.getById ) {
            Expr.filter["ID"] = function( id ) {
                var attrId = id.replace( runescape, funescape );
                return function( elem ) {
                    return elem.getAttribute("id") === attrId;
                };
            };
            Expr.find["ID"] = function( id, context ) {
                if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
                    var elem = context.getElementById( id );
                    return elem ? [ elem ] : [];
                }
            };
        } else {
            Expr.filter["ID"] =  function( id ) {
                var attrId = id.replace( runescape, funescape );
                return function( elem ) {
                    var node = typeof elem.getAttributeNode !== "undefined" &&
                        elem.getAttributeNode("id");
                    return node && node.value === attrId;
                };
            };
    
            // Support: IE 6 - 7 only
            // getElementById is not reliable as a find shortcut
            Expr.find["ID"] = function( id, context ) {
                if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
                    var node, i, elems,
                        elem = context.getElementById( id );
    
                    if ( elem ) {
    
                        // Verify the id attribute
                        node = elem.getAttributeNode("id");
                        if ( node && node.value === id ) {
                            return [ elem ];
                        }
    
                        // Fall back on getElementsByName
                        elems = context.getElementsByName( id );
                        i = 0;
                        while ( (elem = elems[i++]) ) {
                            node = elem.getAttributeNode("id");
                            if ( node && node.value === id ) {
                                return [ elem ];
                            }
                        }
                    }
    
                    return [];
                }
            };
        }
    
        // Tag
        Expr.find["TAG"] = support.getElementsByTagName ?
            function( tag, context ) {
                if ( typeof context.getElementsByTagName !== "undefined" ) {
                    return context.getElementsByTagName( tag );
    
                // DocumentFragment nodes don't have gEBTN
                } else if ( support.qsa ) {
                    return context.querySelectorAll( tag );
                }
            } :
    
            function( tag, context ) {
                var elem,
                    tmp = [],
                    i = 0,
                    // By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
                    results = context.getElementsByTagName( tag );
    
                // Filter out possible comments
                if ( tag === "*" ) {
                    while ( (elem = results[i++]) ) {
                        if ( elem.nodeType === 1 ) {
                            tmp.push( elem );
                        }
                    }
    
                    return tmp;
                }
                return results;
            };
    
        // Class
        Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
            if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
                return context.getElementsByClassName( className );
            }
        };
    
        /* QSA/matchesSelector
        ---------------------------------------------------------------------- */
    
        // QSA and matchesSelector support
    
        // matchesSelector(:active) reports false when true (IE9/Opera 11.5)
        rbuggyMatches = [];
    
        // qSa(:focus) reports false when true (Chrome 21)
        // We allow this because of a bug in IE8/9 that throws an error
        // whenever `document.activeElement` is accessed on an iframe
        // So, we allow :focus to pass through QSA all the time to avoid the IE error
        // See https://bugs.jquery.com/ticket/13378
        rbuggyQSA = [];
    
        if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
            // Build QSA regex
            // Regex strategy adopted from Diego Perini
            assert(function( el ) {
                // Select is set to empty string on purpose
                // This is to test IE's treatment of not explicitly
                // setting a boolean content attribute,
                // since its presence should be enough
                // https://bugs.jquery.com/ticket/12359
                docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
                    "<select id='" + expando + "-\r\\' msallowcapture=''>" +
                    "<option selected=''></option></select>";
    
                // Support: IE8, Opera 11-12.16
                // Nothing should be selected when empty strings follow ^= or $= or *=
                // The test attribute must be unknown in Opera but "safe" for WinRT
                // https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
                if ( el.querySelectorAll("[msallowcapture^='']").length ) {
                    rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
                }
    
                // Support: IE8
                // Boolean attributes and "value" are not treated correctly
                if ( !el.querySelectorAll("[selected]").length ) {
                    rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
                }
    
                // Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
                if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
                    rbuggyQSA.push("~=");
                }
    
                // Webkit/Opera - :checked should return selected option elements
                // http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
                // IE8 throws error here and will not see later tests
                if ( !el.querySelectorAll(":checked").length ) {
                    rbuggyQSA.push(":checked");
                }
    
                // Support: Safari 8+, iOS 8+
                // https://bugs.webkit.org/show_bug.cgi?id=136851
                // In-page `selector#id sibling-combinator selector` fails
                if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
                    rbuggyQSA.push(".#.+[+~]");
                }
            });
    
            assert(function( el ) {
                el.innerHTML = "<a href='' disabled='disabled'></a>" +
                    "<select disabled='disabled'><option/></select>";
    
                // Support: Windows 8 Native Apps
                // The type and name attributes are restricted during .innerHTML assignment
                var input = document.createElement("input");
                input.setAttribute( "type", "hidden" );
                el.appendChild( input ).setAttribute( "name", "D" );
    
                // Support: IE8
                // Enforce case-sensitivity of name attribute
                if ( el.querySelectorAll("[name=d]").length ) {
                    rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
                }
    
                // FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
                // IE8 throws error here and will not see later tests
                if ( el.querySelectorAll(":enabled").length !== 2 ) {
                    rbuggyQSA.push( ":enabled", ":disabled" );
                }
    
                // Support: IE9-11+
                // IE's :disabled selector does not pick up the children of disabled fieldsets
                docElem.appendChild( el ).disabled = true;
                if ( el.querySelectorAll(":disabled").length !== 2 ) {
                    rbuggyQSA.push( ":enabled", ":disabled" );
                }
    
                // Opera 10-11 does not throw on post-comma invalid pseudos
                el.querySelectorAll("*,:x");
                rbuggyQSA.push(",.*:");
            });
        }
    
        if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
            docElem.webkitMatchesSelector ||
            docElem.mozMatchesSelector ||
            docElem.oMatchesSelector ||
            docElem.msMatchesSelector) )) ) {
    
            assert(function( el ) {
                // Check to see if it's possible to do matchesSelector
                // on a disconnected node (IE 9)
                support.disconnectedMatch = matches.call( el, "*" );
    
                // This should fail with an exception
                // Gecko does not error, returns false instead
                matches.call( el, "[s!='']:x" );
                rbuggyMatches.push( "!=", pseudos );
            });
        }
    
        rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
        rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );
    
        /* Contains
        ---------------------------------------------------------------------- */
        hasCompare = rnative.test( docElem.compareDocumentPosition );
    
        // Element contains another
        // Purposefully self-exclusive
        // As in, an element does not contain itself
        contains = hasCompare || rnative.test( docElem.contains ) ?
            function( a, b ) {
                var adown = a.nodeType === 9 ? a.documentElement : a,
                    bup = b && b.parentNode;
                return a === bup || !!( bup && bup.nodeType === 1 && (
                    adown.contains ?
                        adown.contains( bup ) :
                        a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
                ));
            } :
            function( a, b ) {
                if ( b ) {
                    while ( (b = b.parentNode) ) {
                        if ( b === a ) {
                            return true;
                        }
                    }
                }
                return false;
            };
    
        /* Sorting
        ---------------------------------------------------------------------- */
    
        // Document order sorting
        sortOrder = hasCompare ?
        function( a, b ) {
    
            // Flag for duplicate removal
            if ( a === b ) {
                hasDuplicate = true;
                return 0;
            }
    
            // Sort on method existence if only one input has compareDocumentPosition
            var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
            if ( compare ) {
                return compare;
            }
    
            // Calculate position if both inputs belong to the same document
            compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
                a.compareDocumentPosition( b ) :
    
                // Otherwise we know they are disconnected
                1;
    
            // Disconnected nodes
            if ( compare & 1 ||
                (!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {
    
                // Choose the first element that is related to our preferred document
                if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
                    return -1;
                }
                if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
                    return 1;
                }
    
                // Maintain original order
                return sortInput ?
                    ( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
                    0;
            }
    
            return compare & 4 ? -1 : 1;
        } :
        function( a, b ) {
            // Exit early if the nodes are identical
            if ( a === b ) {
                hasDuplicate = true;
                return 0;
            }
    
            var cur,
                i = 0,
                aup = a.parentNode,
                bup = b.parentNode,
                ap = [ a ],
                bp = [ b ];
    
            // Parentless nodes are either documents or disconnected
            if ( !aup || !bup ) {
                return a === document ? -1 :
                    b === document ? 1 :
                    aup ? -1 :
                    bup ? 1 :
                    sortInput ?
                    ( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
                    0;
    
            // If the nodes are siblings, we can do a quick check
            } else if ( aup === bup ) {
                return siblingCheck( a, b );
            }
    
            // Otherwise we need full lists of their ancestors for comparison
            cur = a;
            while ( (cur = cur.parentNode) ) {
                ap.unshift( cur );
            }
            cur = b;
            while ( (cur = cur.parentNode) ) {
                bp.unshift( cur );
            }
    
            // Walk down the tree looking for a discrepancy
            while ( ap[i] === bp[i] ) {
                i++;
            }
    
            return i ?
                // Do a sibling check if the nodes have a common ancestor
                siblingCheck( ap[i], bp[i] ) :
    
                // Otherwise nodes in our document sort first
                ap[i] === preferredDoc ? -1 :
                bp[i] === preferredDoc ? 1 :
                0;
        };
    
        return document;
    };
    
    Sizzle.matches = function( expr, elements ) {
        return Sizzle( expr, null, null, elements );
    };
    
    Sizzle.matchesSelector = function( elem, expr ) {
        // Set document vars if needed
        if ( ( elem.ownerDocument || elem ) !== document ) {
            setDocument( elem );
        }
    
        // Make sure that attribute selectors are quoted
        expr = expr.replace( rattributeQuotes, "='$1']" );
    
        if ( support.matchesSelector && documentIsHTML &&
            !compilerCache[ expr + " " ] &&
            ( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
            ( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {
    
            try {
                var ret = matches.call( elem, expr );
    
                // IE 9's matchesSelector returns false on disconnected nodes
                if ( ret || support.disconnectedMatch ||
                        // As well, disconnected nodes are said to be in a document
                        // fragment in IE 9
                        elem.document && elem.document.nodeType !== 11 ) {
                    return ret;
                }
            } catch (e) {}
        }
    
        return Sizzle( expr, document, null, [ elem ] ).length > 0;
    };
    
    Sizzle.contains = function( context, elem ) {
        // Set document vars if needed
        if ( ( context.ownerDocument || context ) !== document ) {
            setDocument( context );
        }
        return contains( context, elem );
    };
    
    Sizzle.attr = function( elem, name ) {
        // Set document vars if needed
        if ( ( elem.ownerDocument || elem ) !== document ) {
            setDocument( elem );
        }
    
        var fn = Expr.attrHandle[ name.toLowerCase() ],
            // Don't get fooled by Object.prototype properties (jQuery #13807)
            val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
                fn( elem, name, !documentIsHTML ) :
                undefined;
    
        return val !== undefined ?
            val :
            support.attributes || !documentIsHTML ?
                elem.getAttribute( name ) :
                (val = elem.getAttributeNode(name)) && val.specified ?
                    val.value :
                    null;
    };
    
    Sizzle.escape = function( sel ) {
        return (sel + "").replace( rcssescape, fcssescape );
    };
    
    Sizzle.error = function( msg ) {
        throw new Error( "Syntax error, unrecognized expression: " + msg );
    };
    
    /**
     * Document sorting and removing duplicates
     * @param {ArrayLike} results
     */
    Sizzle.uniqueSort = function( results ) {
        var elem,
            duplicates = [],
            j = 0,
            i = 0;
    
        // Unless we *know* we can detect duplicates, assume their presence
        hasDuplicate = !support.detectDuplicates;
        sortInput = !support.sortStable && results.slice( 0 );
        results.sort( sortOrder );
    
        if ( hasDuplicate ) {
            while ( (elem = results[i++]) ) {
                if ( elem === results[ i ] ) {
                    j = duplicates.push( i );
                }
            }
            while ( j-- ) {
                results.splice( duplicates[ j ], 1 );
            }
        }
    
        // Clear input after sorting to release objects
        // See https://github.com/jquery/sizzle/pull/225
        sortInput = null;
    
        return results;
    };
    
    /**
     * Utility function for retrieving the text value of an array of DOM nodes
     * @param {Array|Element} elem
     */
    getText = Sizzle.getText = function( elem ) {
        var node,
            ret = "",
            i = 0,
            nodeType = elem.nodeType;
    
        if ( !nodeType ) {
            // If no nodeType, this is expected to be an array
            while ( (node = elem[i++]) ) {
                // Do not traverse comment nodes
                ret += getText( node );
            }
        } else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
            // Use textContent for elements
            // innerText usage removed for consistency of new lines (jQuery #11153)
            if ( typeof elem.textContent === "string" ) {
                return elem.textContent;
            } else {
                // Traverse its children
                for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
                    ret += getText( elem );
                }
            }
        } else if ( nodeType === 3 || nodeType === 4 ) {
            return elem.nodeValue;
        }
        // Do not include comment or processing instruction nodes
    
        return ret;
    };
    
    Expr = Sizzle.selectors = {
    
        // Can be adjusted by the user
        cacheLength: 50,
    
        createPseudo: markFunction,
    
        match: matchExpr,
    
        attrHandle: {},
    
        find: {},
    
        relative: {
            ">": { dir: "parentNode", first: true },
            " ": { dir: "parentNode" },
            "+": { dir: "previousSibling", first: true },
            "~": { dir: "previousSibling" }
        },
    
        preFilter: {
            "ATTR": function( match ) {
                match[1] = match[1].replace( runescape, funescape );
    
                // Move the given value to match[3] whether quoted or unquoted
                match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );
    
                if ( match[2] === "~=" ) {
                    match[3] = " " + match[3] + " ";
                }
    
                return match.slice( 0, 4 );
            },
    
            "CHILD": function( match ) {
                /* matches from matchExpr["CHILD"]
                    1 type (only|nth|...)
                    2 what (child|of-type)
                    3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
                    4 xn-component of xn+y argument ([+-]?\d*n|)
                    5 sign of xn-component
                    6 x of xn-component
                    7 sign of y-component
                    8 y of y-component
                */
                match[1] = match[1].toLowerCase();
    
                if ( match[1].slice( 0, 3 ) === "nth" ) {
                    // nth-* requires argument
                    if ( !match[3] ) {
                        Sizzle.error( match[0] );
                    }
    
                    // numeric x and y parameters for Expr.filter.CHILD
                    // remember that false/true cast respectively to 0/1
                    match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
                    match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );
    
                // other types prohibit arguments
                } else if ( match[3] ) {
                    Sizzle.error( match[0] );
                }
    
                return match;
            },
    
            "PSEUDO": function( match ) {
                var excess,
                    unquoted = !match[6] && match[2];
    
                if ( matchExpr["CHILD"].test( match[0] ) ) {
                    return null;
                }
    
                // Accept quoted arguments as-is
                if ( match[3] ) {
                    match[2] = match[4] || match[5] || "";
    
                // Strip excess characters from unquoted arguments
                } else if ( unquoted && rpseudo.test( unquoted ) &&
                    // Get excess from tokenize (recursively)
                    (excess = tokenize( unquoted, true )) &&
                    // advance to the next closing parenthesis
                    (excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {
    
                    // excess is a negative index
                    match[0] = match[0].slice( 0, excess );
                    match[2] = unquoted.slice( 0, excess );
                }
    
                // Return only captures needed by the pseudo filter method (type and argument)
                return match.slice( 0, 3 );
            }
        },
    
        filter: {
    
            "TAG": function( nodeNameSelector ) {
                var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
                return nodeNameSelector === "*" ?
                    function() { return true; } :
                    function( elem ) {
                        return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
                    };
            },
    
            "CLASS": function( className ) {
                var pattern = classCache[ className + " " ];
    
                return pattern ||
                    (pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
                    classCache( className, function( elem ) {
                        return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
                    });
            },
    
            "ATTR": function( name, operator, check ) {
                return function( elem ) {
                    var result = Sizzle.attr( elem, name );
    
                    if ( result == null ) {
                        return operator === "!=";
                    }
                    if ( !operator ) {
                        return true;
                    }
    
                    result += "";
    
                    return operator === "=" ? result === check :
                        operator === "!=" ? result !== check :
                        operator === "^=" ? check && result.indexOf( check ) === 0 :
                        operator === "*=" ? check && result.indexOf( check ) > -1 :
                        operator === "$=" ? check && result.slice( -check.length ) === check :
                        operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
                        operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
                        false;
                };
            },
    
            "CHILD": function( type, what, argument, first, last ) {
                var simple = type.slice( 0, 3 ) !== "nth",
                    forward = type.slice( -4 ) !== "last",
                    ofType = what === "of-type";
    
                return first === 1 && last === 0 ?
    
                    // Shortcut for :nth-*(n)
                    function( elem ) {
                        return !!elem.parentNode;
                    } :
    
                    function( elem, context, xml ) {
                        var cache, uniqueCache, outerCache, node, nodeIndex, start,
                            dir = simple !== forward ? "nextSibling" : "previousSibling",
                            parent = elem.parentNode,
                            name = ofType && elem.nodeName.toLowerCase(),
                            useCache = !xml && !ofType,
                            diff = false;
    
                        if ( parent ) {
    
                            // :(first|last|only)-(child|of-type)
                            if ( simple ) {
                                while ( dir ) {
                                    node = elem;
                                    while ( (node = node[ dir ]) ) {
                                        if ( ofType ?
                                            node.nodeName.toLowerCase() === name :
                                            node.nodeType === 1 ) {
    
                                            return false;
                                        }
                                    }
                                    // Reverse direction for :only-* (if we haven't yet done so)
                                    start = dir = type === "only" && !start && "nextSibling";
                                }
                                return true;
                            }
    
                            start = [ forward ? parent.firstChild : parent.lastChild ];
    
                            // non-xml :nth-child(...) stores cache data on `parent`
                            if ( forward && useCache ) {
    
                                // Seek `elem` from a previously-cached index
    
                                // ...in a gzip-friendly way
                                node = parent;
                                outerCache = node[ expando ] || (node[ expando ] = {});
    
                                // Support: IE <9 only
                                // Defend against cloned attroperties (jQuery gh-1709)
                                uniqueCache = outerCache[ node.uniqueID ] ||
                                    (outerCache[ node.uniqueID ] = {});
    
                                cache = uniqueCache[ type ] || [];
                                nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
                                diff = nodeIndex && cache[ 2 ];
                                node = nodeIndex && parent.childNodes[ nodeIndex ];
    
                                while ( (node = ++nodeIndex && node && node[ dir ] ||
    
                                    // Fallback to seeking `elem` from the start
                                    (diff = nodeIndex = 0) || start.pop()) ) {
    
                                    // When found, cache indexes on `parent` and break
                                    if ( node.nodeType === 1 && ++diff && node === elem ) {
                                        uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
                                        break;
                                    }
                                }
    
                            } else {
                                // Use previously-cached element index if available
                                if ( useCache ) {
                                    // ...in a gzip-friendly way
                                    node = elem;
                                    outerCache = node[ expando ] || (node[ expando ] = {});
    
                                    // Support: IE <9 only
                                    // Defend against cloned attroperties (jQuery gh-1709)
                                    uniqueCache = outerCache[ node.uniqueID ] ||
                                        (outerCache[ node.uniqueID ] = {});
    
                                    cache = uniqueCache[ type ] || [];
                                    nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
                                    diff = nodeIndex;
                                }
    
                                // xml :nth-child(...)
                                // or :nth-last-child(...) or :nth(-last)?-of-type(...)
                                if ( diff === false ) {
                                    // Use the same loop as above to seek `elem` from the start
                                    while ( (node = ++nodeIndex && node && node[ dir ] ||
                                        (diff = nodeIndex = 0) || start.pop()) ) {
    
                                        if ( ( ofType ?
                                            node.nodeName.toLowerCase() === name :
                                            node.nodeType === 1 ) &&
                                            ++diff ) {
    
                                            // Cache the index of each encountered element
                                            if ( useCache ) {
                                                outerCache = node[ expando ] || (node[ expando ] = {});
    
                                                // Support: IE <9 only
                                                // Defend against cloned attroperties (jQuery gh-1709)
                                                uniqueCache = outerCache[ node.uniqueID ] ||
                                                    (outerCache[ node.uniqueID ] = {});
    
                                                uniqueCache[ type ] = [ dirruns, diff ];
                                            }
    
                                            if ( node === elem ) {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
    
                            // Incorporate the offset, then check against cycle size
                            diff -= last;
                            return diff === first || ( diff % first === 0 && diff / first >= 0 );
                        }
                    };
            },
    
            "PSEUDO": function( pseudo, argument ) {
                // pseudo-class names are case-insensitive
                // http://www.w3.org/TR/selectors/#pseudo-classes
                // Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
                // Remember that setFilters inherits from pseudos
                var args,
                    fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
                        Sizzle.error( "unsupported pseudo: " + pseudo );
    
                // The user may use createPseudo to indicate that
                // arguments are needed to create the filter function
                // just as Sizzle does
                if ( fn[ expando ] ) {
                    return fn( argument );
                }
    
                // But maintain support for old signatures
                if ( fn.length > 1 ) {
                    args = [ pseudo, pseudo, "", argument ];
                    return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
                        markFunction(function( seed, matches ) {
                            var idx,
                                matched = fn( seed, argument ),
                                i = matched.length;
                            while ( i-- ) {
                                idx = indexOf( seed, matched[i] );
                                seed[ idx ] = !( matches[ idx ] = matched[i] );
                            }
                        }) :
                        function( elem ) {
                            return fn( elem, 0, args );
                        };
                }
    
                return fn;
            }
        },
    
        pseudos: {
            // Potentially complex pseudos
            "not": markFunction(function( selector ) {
                // Trim the selector passed to compile
                // to avoid treating leading and trailing
                // spaces as combinators
                var input = [],
                    results = [],
                    matcher = compile( selector.replace( rtrim, "$1" ) );
    
                return matcher[ expando ] ?
                    markFunction(function( seed, matches, context, xml ) {
                        var elem,
                            unmatched = matcher( seed, null, xml, [] ),
                            i = seed.length;
    
                        // Match elements unmatched by `matcher`
                        while ( i-- ) {
                            if ( (elem = unmatched[i]) ) {
                                seed[i] = !(matches[i] = elem);
                            }
                        }
                    }) :
                    function( elem, context, xml ) {
                        input[0] = elem;
                        matcher( input, null, xml, results );
                        // Don't keep the element (issue #299)
                        input[0] = null;
                        return !results.pop();
                    };
            }),
    
            "has": markFunction(function( selector ) {
                return function( elem ) {
                    return Sizzle( selector, elem ).length > 0;
                };
            }),
    
            "contains": markFunction(function( text ) {
                text = text.replace( runescape, funescape );
                return function( elem ) {
                    return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
                };
            }),
    
            // "Whether an element is represented by a :lang() selector
            // is based solely on the element's language value
            // being equal to the identifier C,
            // or beginning with the identifier C immediately followed by "-".
            // The matching of C against the element's language value is performed case-insensitively.
            // The identifier C does not have to be a valid language name."
            // http://www.w3.org/TR/selectors/#lang-pseudo
            "lang": markFunction( function( lang ) {
                // lang value must be a valid identifier
                if ( !ridentifier.test(lang || "") ) {
                    Sizzle.error( "unsupported lang: " + lang );
                }
                lang = lang.replace( runescape, funescape ).toLowerCase();
                return function( elem ) {
                    var elemLang;
                    do {
                        if ( (elemLang = documentIsHTML ?
                            elem.lang :
                            elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {
    
                            elemLang = elemLang.toLowerCase();
                            return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
                        }
                    } while ( (elem = elem.parentNode) && elem.nodeType === 1 );
                    return false;
                };
            }),
    
            // Miscellaneous
            "target": function( elem ) {
                var hash = window.location && window.location.hash;
                return hash && hash.slice( 1 ) === elem.id;
            },
    
            "root": function( elem ) {
                return elem === docElem;
            },
    
            "focus": function( elem ) {
                return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
            },
    
            // Boolean properties
            "enabled": createDisabledPseudo( false ),
            "disabled": createDisabledPseudo( true ),
    
            "checked": function( elem ) {
                // In CSS3, :checked should return both checked and selected elements
                // http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
                var nodeName = elem.nodeName.toLowerCase();
                return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
            },
    
            "selected": function( elem ) {
                // Accessing this property makes selected-by-default
                // options in Safari work properly
                if ( elem.parentNode ) {
                    elem.parentNode.selectedIndex;
                }
    
                return elem.selected === true;
            },
    
            // Contents
            "empty": function( elem ) {
                // http://www.w3.org/TR/selectors/#empty-pseudo
                // :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
                //   but not by others (comment: 8; processing instruction: 7; etc.)
                // nodeType < 6 works because attributes (2) do not appear as children
                for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
                    if ( elem.nodeType < 6 ) {
                        return false;
                    }
                }
                return true;
            },
    
            "parent": function( elem ) {
                return !Expr.pseudos["empty"]( elem );
            },
    
            // Element/input types
            "header": function( elem ) {
                return rheader.test( elem.nodeName );
            },
    
            "input": function( elem ) {
                return rinputs.test( elem.nodeName );
            },
    
            "button": function( elem ) {
                var name = elem.nodeName.toLowerCase();
                return name === "input" && elem.type === "button" || name === "button";
            },
    
            "text": function( elem ) {
                var attr;
                return elem.nodeName.toLowerCase() === "input" &&
                    elem.type === "text" &&
    
                    // Support: IE<8
                    // New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
                    ( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
            },
    
            // Position-in-collection
            "first": createPositionalPseudo(function() {
                return [ 0 ];
            }),
    
            "last": createPositionalPseudo(function( matchIndexes, length ) {
                return [ length - 1 ];
            }),
    
            "eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
                return [ argument < 0 ? argument + length : argument ];
            }),
    
            "even": createPositionalPseudo(function( matchIndexes, length ) {
                var i = 0;
                for ( ; i < length; i += 2 ) {
                    matchIndexes.push( i );
                }
                return matchIndexes;
            }),
    
            "odd": createPositionalPseudo(function( matchIndexes, length ) {
                var i = 1;
                for ( ; i < length; i += 2 ) {
                    matchIndexes.push( i );
                }
                return matchIndexes;
            }),
    
            "lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
                var i = argument < 0 ? argument + length : argument;
                for ( ; --i >= 0; ) {
                    matchIndexes.push( i );
                }
                return matchIndexes;
            }),
    
            "gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
                var i = argument < 0 ? argument + length : argument;
                for ( ; ++i < length; ) {
                    matchIndexes.push( i );
                }
                return matchIndexes;
            })
        }
    };
    
    Expr.pseudos["nth"] = Expr.pseudos["eq"];
    
    // Add button/input type pseudos
    for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
        Expr.pseudos[ i ] = createInputPseudo( i );
    }
    for ( i in { submit: true, reset: true } ) {
        Expr.pseudos[ i ] = createButtonPseudo( i );
    }
    
    // Easy API for creating new setFilters
    function setFilters() {}
    setFilters.prototype = Expr.filters = Expr.pseudos;
    Expr.setFilters = new setFilters();
    
    tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
        var matched, match, tokens, type,
            soFar, groups, preFilters,
            cached = tokenCache[ selector + " " ];
    
        if ( cached ) {
            return parseOnly ? 0 : cached.slice( 0 );
        }
    
        soFar = selector;
        groups = [];
        preFilters = Expr.preFilter;
    
        while ( soFar ) {
    
            // Comma and first run
            if ( !matched || (match = rcomma.exec( soFar )) ) {
                if ( match ) {
                    // Don't consume trailing commas as valid
                    soFar = soFar.slice( match[0].length ) || soFar;
                }
                groups.push( (tokens = []) );
            }
    
            matched = false;
    
            // Combinators
            if ( (match = rcombinators.exec( soFar )) ) {
                matched = match.shift();
                tokens.push({
                    value: matched,
                    // Cast descendant combinators to space
                    type: match[0].replace( rtrim, " " )
                });
                soFar = soFar.slice( matched.length );
            }
    
            // Filters
            for ( type in Expr.filter ) {
                if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
                    (match = preFilters[ type ]( match ))) ) {
                    matched = match.shift();
                    tokens.push({
                        value: matched,
                        type: type,
                        matches: match
                    });
                    soFar = soFar.slice( matched.length );
                }
            }
    
            if ( !matched ) {
                break;
            }
        }
    
        // Return the length of the invalid excess
        // if we're just parsing
        // Otherwise, throw an error or return tokens
        return parseOnly ?
            soFar.length :
            soFar ?
                Sizzle.error( selector ) :
                // Cache the tokens
                tokenCache( selector, groups ).slice( 0 );
    };
    
    function toSelector( tokens ) {
        var i = 0,
            len = tokens.length,
            selector = "";
        for ( ; i < len; i++ ) {
            selector += tokens[i].value;
        }
        return selector;
    }
    
    function addCombinator( matcher, combinator, base ) {
        var dir = combinator.dir,
            skip = combinator.next,
            key = skip || dir,
            checkNonElements = base && key === "parentNode",
            doneName = done++;
    
        return combinator.first ?
            // Check against closest ancestor/preceding element
            function( elem, context, xml ) {
                while ( (elem = elem[ dir ]) ) {
                    if ( elem.nodeType === 1 || checkNonElements ) {
                        return matcher( elem, context, xml );
                    }
                }
                return false;
            } :
    
            // Check against all ancestor/preceding elements
            function( elem, context, xml ) {
                var oldCache, uniqueCache, outerCache,
                    newCache = [ dirruns, doneName ];
    
                // We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
                if ( xml ) {
                    while ( (elem = elem[ dir ]) ) {
                        if ( elem.nodeType === 1 || checkNonElements ) {
                            if ( matcher( elem, context, xml ) ) {
                                return true;
                            }
                        }
                    }
                } else {
                    while ( (elem = elem[ dir ]) ) {
                        if ( elem.nodeType === 1 || checkNonElements ) {
                            outerCache = elem[ expando ] || (elem[ expando ] = {});
    
                            // Support: IE <9 only
                            // Defend against cloned attroperties (jQuery gh-1709)
                            uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});
    
                            if ( skip && skip === elem.nodeName.toLowerCase() ) {
                                elem = elem[ dir ] || elem;
                            } else if ( (oldCache = uniqueCache[ key ]) &&
                                oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {
    
                                // Assign to newCache so results back-propagate to previous elements
                                return (newCache[ 2 ] = oldCache[ 2 ]);
                            } else {
                                // Reuse newcache so results back-propagate to previous elements
                                uniqueCache[ key ] = newCache;
    
                                // A match means we're done; a fail means we have to keep checking
                                if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            };
    }
    
    function elementMatcher( matchers ) {
        return matchers.length > 1 ?
            function( elem, context, xml ) {
                var i = matchers.length;
                while ( i-- ) {
                    if ( !matchers[i]( elem, context, xml ) ) {
                        return false;
                    }
                }
                return true;
            } :
            matchers[0];
    }
    
    function multipleContexts( selector, contexts, results ) {
        var i = 0,
            len = contexts.length;
        for ( ; i < len; i++ ) {
            Sizzle( selector, contexts[i], results );
        }
        return results;
    }
    
    function condense( unmatched, map, filter, context, xml ) {
        var elem,
            newUnmatched = [],
            i = 0,
            len = unmatched.length,
            mapped = map != null;
    
        for ( ; i < len; i++ ) {
            if ( (elem = unmatched[i]) ) {
                if ( !filter || filter( elem, context, xml ) ) {
                    newUnmatched.push( elem );
                    if ( mapped ) {
                        map.push( i );
                    }
                }
            }
        }
    
        return newUnmatched;
    }
    
    function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
        if ( postFilter && !postFilter[ expando ] ) {
            postFilter = setMatcher( postFilter );
        }
        if ( postFinder && !postFinder[ expando ] ) {
            postFinder = setMatcher( postFinder, postSelector );
        }
        return markFunction(function( seed, results, context, xml ) {
            var temp, i, elem,
                preMap = [],
                postMap = [],
                preexisting = results.length,
    
                // Get initial elements from seed or context
                elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),
    
                // Prefilter to get matcher input, preserving a map for seed-results synchronization
                matcherIn = preFilter && ( seed || !selector ) ?
                    condense( elems, preMap, preFilter, context, xml ) :
                    elems,
    
                matcherOut = matcher ?
                    // If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
                    postFinder || ( seed ? preFilter : preexisting || postFilter ) ?
    
                        // ...intermediate processing is necessary
                        [] :
    
                        // ...otherwise use results directly
                        results :
                    matcherIn;
    
            // Find primary matches
            if ( matcher ) {
                matcher( matcherIn, matcherOut, context, xml );
            }
    
            // Apply postFilter
            if ( postFilter ) {
                temp = condense( matcherOut, postMap );
                postFilter( temp, [], context, xml );
    
                // Un-match failing elements by moving them back to matcherIn
                i = temp.length;
                while ( i-- ) {
                    if ( (elem = temp[i]) ) {
                        matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
                    }
                }
            }
    
            if ( seed ) {
                if ( postFinder || preFilter ) {
                    if ( postFinder ) {
                        // Get the final matcherOut by condensing this intermediate into postFinder contexts
                        temp = [];
                        i = matcherOut.length;
                        while ( i-- ) {
                            if ( (elem = matcherOut[i]) ) {
                                // Restore matcherIn since elem is not yet a final match
                                temp.push( (matcherIn[i] = elem) );
                            }
                        }
                        postFinder( null, (matcherOut = []), temp, xml );
                    }
    
                    // Move matched elements from seed to results to keep them synchronized
                    i = matcherOut.length;
                    while ( i-- ) {
                        if ( (elem = matcherOut[i]) &&
                            (temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {
    
                            seed[temp] = !(results[temp] = elem);
                        }
                    }
                }
    
            // Add elements to results, through postFinder if defined
            } else {
                matcherOut = condense(
                    matcherOut === results ?
                        matcherOut.splice( preexisting, matcherOut.length ) :
                        matcherOut
                );
                if ( postFinder ) {
                    postFinder( null, results, matcherOut, xml );
                } else {
                    push.apply( results, matcherOut );
                }
            }
        });
    }
    
    function matcherFromTokens( tokens ) {
        var checkContext, matcher, j,
            len = tokens.length,
            leadingRelative = Expr.relative[ tokens[0].type ],
            implicitRelative = leadingRelative || Expr.relative[" "],
            i = leadingRelative ? 1 : 0,
    
            // The foundational matcher ensures that elements are reachable from top-level context(s)
            matchContext = addCombinator( function( elem ) {
                return elem === checkContext;
            }, implicitRelative, true ),
            matchAnyContext = addCombinator( function( elem ) {
                return indexOf( checkContext, elem ) > -1;
            }, implicitRelative, true ),
            matchers = [ function( elem, context, xml ) {
                var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
                    (checkContext = context).nodeType ?
                        matchContext( elem, context, xml ) :
                        matchAnyContext( elem, context, xml ) );
                // Avoid hanging onto element (issue #299)
                checkContext = null;
                return ret;
            } ];
    
        for ( ; i < len; i++ ) {
            if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
                matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
            } else {
                matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );
    
                // Return special upon seeing a positional matcher
                if ( matcher[ expando ] ) {
                    // Find the next relative operator (if any) for proper handling
                    j = ++i;
                    for ( ; j < len; j++ ) {
                        if ( Expr.relative[ tokens[j].type ] ) {
                            break;
                        }
                    }
                    return setMatcher(
                        i > 1 && elementMatcher( matchers ),
                        i > 1 && toSelector(
                            // If the preceding token was a descendant combinator, insert an implicit any-element `*`
                            tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
                        ).replace( rtrim, "$1" ),
                        matcher,
                        i < j && matcherFromTokens( tokens.slice( i, j ) ),
                        j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
                        j < len && toSelector( tokens )
                    );
                }
                matchers.push( matcher );
            }
        }
    
        return elementMatcher( matchers );
    }
    
    function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
        var bySet = setMatchers.length > 0,
            byElement = elementMatchers.length > 0,
            superMatcher = function( seed, context, xml, results, outermost ) {
                var elem, j, matcher,
                    matchedCount = 0,
                    i = "0",
                    unmatched = seed && [],
                    setMatched = [],
                    contextBackup = outermostContext,
                    // We must always have either seed elements or outermost context
                    elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
                    // Use integer dirruns iff this is the outermost matcher
                    dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
                    len = elems.length;
    
                if ( outermost ) {
                    outermostContext = context === document || context || outermost;
                }
    
                // Add elements passing elementMatchers directly to results
                // Support: IE<9, Safari
                // Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
                for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
                    if ( byElement && elem ) {
                        j = 0;
                        if ( !context && elem.ownerDocument !== document ) {
                            setDocument( elem );
                            xml = !documentIsHTML;
                        }
                        while ( (matcher = elementMatchers[j++]) ) {
                            if ( matcher( elem, context || document, xml) ) {
                                results.push( elem );
                                break;
                            }
                        }
                        if ( outermost ) {
                            dirruns = dirrunsUnique;
                        }
                    }
    
                    // Track unmatched elements for set filters
                    if ( bySet ) {
                        // They will have gone through all possible matchers
                        if ( (elem = !matcher && elem) ) {
                            matchedCount--;
                        }
    
                        // Lengthen the array for every element, matched or not
                        if ( seed ) {
                            unmatched.push( elem );
                        }
                    }
                }
    
                // `i` is now the count of elements visited above, and adding it to `matchedCount`
                // makes the latter nonnegative.
                matchedCount += i;
    
                // Apply set filters to unmatched elements
                // NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
                // equals `i`), unless we didn't visit _any_ elements in the above loop because we have
                // no element matchers and no seed.
                // Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
                // case, which will result in a "00" `matchedCount` that differs from `i` but is also
                // numerically zero.
                if ( bySet && i !== matchedCount ) {
                    j = 0;
                    while ( (matcher = setMatchers[j++]) ) {
                        matcher( unmatched, setMatched, context, xml );
                    }
    
                    if ( seed ) {
                        // Reintegrate element matches to eliminate the need for sorting
                        if ( matchedCount > 0 ) {
                            while ( i-- ) {
                                if ( !(unmatched[i] || setMatched[i]) ) {
                                    setMatched[i] = pop.call( results );
                                }
                            }
                        }
    
                        // Discard index placeholder values to get only actual matches
                        setMatched = condense( setMatched );
                    }
    
                    // Add matches to results
                    push.apply( results, setMatched );
    
                    // Seedless set matches succeeding multiple successful matchers stipulate sorting
                    if ( outermost && !seed && setMatched.length > 0 &&
                        ( matchedCount + setMatchers.length ) > 1 ) {
    
                        Sizzle.uniqueSort( results );
                    }
                }
    
                // Override manipulation of globals by nested matchers
                if ( outermost ) {
                    dirruns = dirrunsUnique;
                    outermostContext = contextBackup;
                }
    
                return unmatched;
            };
    
        return bySet ?
            markFunction( superMatcher ) :
            superMatcher;
    }
    
    compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
        var i,
            setMatchers = [],
            elementMatchers = [],
            cached = compilerCache[ selector + " " ];
    
        if ( !cached ) {
            // Generate a function of recursive functions that can be used to check each element
            if ( !match ) {
                match = tokenize( selector );
            }
            i = match.length;
            while ( i-- ) {
                cached = matcherFromTokens( match[i] );
                if ( cached[ expando ] ) {
                    setMatchers.push( cached );
                } else {
                    elementMatchers.push( cached );
                }
            }
    
            // Cache the compiled function
            cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );
    
            // Save selector and tokenization
            cached.selector = selector;
        }
        return cached;
    };
    
    /**
     * A low-level selection function that works with Sizzle's compiled
     *  selector functions
     * @param {String|Function} selector A selector or a pre-compiled
     *  selector function built with Sizzle.compile
     * @param {Element} context
     * @param {Array} [results]
     * @param {Array} [seed] A set of elements to match against
     */
    select = Sizzle.select = function( selector, context, results, seed ) {
        var i, tokens, token, type, find,
            compiled = typeof selector === "function" && selector,
            match = !seed && tokenize( (selector = compiled.selector || selector) );
    
        results = results || [];
    
        // Try to minimize operations if there is only one selector in the list and no seed
        // (the latter of which guarantees us context)
        if ( match.length === 1 ) {
    
            // Reduce context if the leading compound selector is an ID
            tokens = match[0] = match[0].slice( 0 );
            if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
                    context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[1].type ] ) {
    
                context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
                if ( !context ) {
                    return results;
    
                // Precompiled matchers will still verify ancestry, so step up a level
                } else if ( compiled ) {
                    context = context.parentNode;
                }
    
                selector = selector.slice( tokens.shift().value.length );
            }
    
            // Fetch a seed set for right-to-left matching
            i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
            while ( i-- ) {
                token = tokens[i];
    
                // Abort if we hit a combinator
                if ( Expr.relative[ (type = token.type) ] ) {
                    break;
                }
                if ( (find = Expr.find[ type ]) ) {
                    // Search, expanding context for leading sibling combinators
                    if ( (seed = find(
                        token.matches[0].replace( runescape, funescape ),
                        rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
                    )) ) {
    
                        // If seed is empty or no tokens remain, we can return early
                        tokens.splice( i, 1 );
                        selector = seed.length && toSelector( tokens );
                        if ( !selector ) {
                            push.apply( results, seed );
                            return results;
                        }
    
                        break;
                    }
                }
            }
        }
    
        // Compile and execute a filtering function if one is not provided
        // Provide `match` to avoid retokenization if we modified the selector above
        ( compiled || compile( selector, match ) )(
            seed,
            context,
            !documentIsHTML,
            results,
            !context || rsibling.test( selector ) && testContext( context.parentNode ) || context
        );
        return results;
    };
    
    // One-time assignments
    
    // Sort stability
    support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;
    
    // Support: Chrome 14-35+
    // Always assume duplicates if they aren't passed to the comparison function
    support.detectDuplicates = !!hasDuplicate;
    
    // Initialize against the default document
    setDocument();
    
    // Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
    // Detached nodes confoundingly follow *each other*
    support.sortDetached = assert(function( el ) {
        // Should return 1, but returns 4 (following)
        return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
    });
    
    // Support: IE<8
    // Prevent attribute/property "interpolation"
    // https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
    if ( !assert(function( el ) {
        el.innerHTML = "<a href='#'></a>";
        return el.firstChild.getAttribute("href") === "#" ;
    }) ) {
        addHandle( "type|href|height|width", function( elem, name, isXML ) {
            if ( !isXML ) {
                return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
            }
        });
    }
    
    // Support: IE<9
    // Use defaultValue in place of getAttribute("value")
    if ( !support.attributes || !assert(function( el ) {
        el.innerHTML = "<input/>";
        el.firstChild.setAttribute( "value", "" );
        return el.firstChild.getAttribute( "value" ) === "";
    }) ) {
        addHandle( "value", function( elem, name, isXML ) {
            if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
                return elem.defaultValue;
            }
        });
    }
    
    // Support: IE<9
    // Use getAttributeNode to fetch booleans when getAttribute lies
    if ( !assert(function( el ) {
        return el.getAttribute("disabled") == null;
    }) ) {
        addHandle( booleans, function( elem, name, isXML ) {
            var val;
            if ( !isXML ) {
                return elem[ name ] === true ? name.toLowerCase() :
                        (val = elem.getAttributeNode( name )) && val.specified ?
                        val.value :
                    null;
            }
        });
    }
    
    return Sizzle;
    
    })( window );
    
    
    
    jQuery.find = Sizzle;
    jQuery.expr = Sizzle.selectors;
    
    // Deprecated
    jQuery.expr[ ":" ] = jQuery.expr.pseudos;
    jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
    jQuery.text = Sizzle.getText;
    jQuery.isXMLDoc = Sizzle.isXML;
    jQuery.contains = Sizzle.contains;
    jQuery.escapeSelector = Sizzle.escape;
    
    
    
    
    var dir = function( elem, dir, until ) {
        var matched = [],
            truncate = until !== undefined;
    
        while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
            if ( elem.nodeType === 1 ) {
                if ( truncate && jQuery( elem ).is( until ) ) {
                    break;
                }
                matched.push( elem );
            }
        }
        return matched;
    };
    
    
    var siblings = function( n, elem ) {
        var matched = [];
    
        for ( ; n; n = n.nextSibling ) {
            if ( n.nodeType === 1 && n !== elem ) {
                matched.push( n );
            }
        }
    
        return matched;
    };
    
    
    var rneedsContext = jQuery.expr.match.needsContext;
    
    var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );
    
    
    
    var risSimple = /^.[^:#\[\.,]*$/;
    
    // Implement the identical functionality for filter and not
    function winnow( elements, qualifier, not ) {
        if ( jQuery.isFunction( qualifier ) ) {
            return jQuery.grep( elements, function( elem, i ) {
                return !!qualifier.call( elem, i, elem ) !== not;
            } );
        }
    
        // Single element
        if ( qualifier.nodeType ) {
            return jQuery.grep( elements, function( elem ) {
                return ( elem === qualifier ) !== not;
            } );
        }
    
        // Arraylike of elements (jQuery, arguments, Array)
        if ( typeof qualifier !== "string" ) {
            return jQuery.grep( elements, function( elem ) {
                return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
            } );
        }
    
        // Simple selector that can be filtered directly, removing non-Elements
        if ( risSimple.test( qualifier ) ) {
            return jQuery.filter( qualifier, elements, not );
        }
    
        // Complex selector, compare the two sets, removing non-Elements
        qualifier = jQuery.filter( qualifier, elements );
        return jQuery.grep( elements, function( elem ) {
            return ( indexOf.call( qualifier, elem ) > -1 ) !== not && elem.nodeType === 1;
        } );
    }
    
    jQuery.filter = function( expr, elems, not ) {
        var elem = elems[ 0 ];
    
        if ( not ) {
            expr = ":not(" + expr + ")";
        }
    
        if ( elems.length === 1 && elem.nodeType === 1 ) {
            return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
        }
    
        return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
            return elem.nodeType === 1;
        } ) );
    };
    
    jQuery.fn.extend( {
        find: function( selector ) {
            var i, ret,
                len = this.length,
                self = this;
    
            if ( typeof selector !== "string" ) {
                return this.pushStack( jQuery( selector ).filter( function() {
                    for ( i = 0; i < len; i++ ) {
                        if ( jQuery.contains( self[ i ], this ) ) {
                            return true;
                        }
                    }
                } ) );
            }
    
            ret = this.pushStack( [] );
    
            for ( i = 0; i < len; i++ ) {
                jQuery.find( selector, self[ i ], ret );
            }
    
            return len > 1 ? jQuery.uniqueSort( ret ) : ret;
        },
        filter: function( selector ) {
            return this.pushStack( winnow( this, selector || [], false ) );
        },
        not: function( selector ) {
            return this.pushStack( winnow( this, selector || [], true ) );
        },
        is: function( selector ) {
            return !!winnow(
                this,
    
                // If this is a positional/relative selector, check membership in the returned set
                // so $("p:first").is("p:last") won't return true for a doc with two "p".
                typeof selector === "string" && rneedsContext.test( selector ) ?
                    jQuery( selector ) :
                    selector || [],
                false
            ).length;
        }
    } );
    
    
    // Initialize a jQuery object
    
    
    // A central reference to the root jQuery(document)
    var rootjQuery,
    
        // A simple way to check for HTML strings
        // Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
        // Strict HTML recognition (#11290: must start with <)
        // Shortcut simple #id case for speed
        rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,
    
        init = jQuery.fn.init = function( selector, context, root ) {
            var match, elem;
    
            // HANDLE: $(""), $(null), $(undefined), $(false)
            if ( !selector ) {
                return this;
            }
    
            // Method init() accepts an alternate rootjQuery
            // so migrate can support jQuery.sub (gh-2101)
            root = root || rootjQuery;
    
            // Handle HTML strings
            if ( typeof selector === "string" ) {
                if ( selector[ 0 ] === "<" &&
                    selector[ selector.length - 1 ] === ">" &&
                    selector.length >= 3 ) {
    
                    // Assume that strings that start and end with <> are HTML and skip the regex check
                    match = [ null, selector, null ];
    
                } else {
                    match = rquickExpr.exec( selector );
                }
    
                // Match html or make sure no context is specified for #id
                if ( match && ( match[ 1 ] || !context ) ) {
    
                    // HANDLE: $(html) -> $(array)
                    if ( match[ 1 ] ) {
                        context = context instanceof jQuery ? context[ 0 ] : context;
    
                        // Option to run scripts is true for back-compat
                        // Intentionally let the error be thrown if parseHTML is not present
                        jQuery.merge( this, jQuery.parseHTML(
                            match[ 1 ],
                            context && context.nodeType ? context.ownerDocument || context : document,
                            true
                        ) );
    
                        // HANDLE: $(html, props)
                        if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
                            for ( match in context ) {
    
                                // Properties of context are called as methods if possible
                                if ( jQuery.isFunction( this[ match ] ) ) {
                                    this[ match ]( context[ match ] );
    
                                // ...and otherwise set as attributes
                                } else {
                                    this.attr( match, context[ match ] );
                                }
                            }
                        }
    
                        return this;
    
                    // HANDLE: $(#id)
                    } else {
                        elem = document.getElementById( match[ 2 ] );
    
                        if ( elem ) {
    
                            // Inject the element directly into the jQuery object
                            this[ 0 ] = elem;
                            this.length = 1;
                        }
                        return this;
                    }
    
                // HANDLE: $(expr, $(...))
                } else if ( !context || context.jquery ) {
                    return ( context || root ).find( selector );
    
                // HANDLE: $(expr, context)
                // (which is just equivalent to: $(context).find(expr)
                } else {
                    return this.constructor( context ).find( selector );
                }
    
            // HANDLE: $(DOMElement)
            } else if ( selector.nodeType ) {
                this[ 0 ] = selector;
                this.length = 1;
                return this;
    
            // HANDLE: $(function)
            // Shortcut for document ready
            } else if ( jQuery.isFunction( selector ) ) {
                return root.ready !== undefined ?
                    root.ready( selector ) :
    
                    // Execute immediately if ready is not present
                    selector( jQuery );
            }
    
            return jQuery.makeArray( selector, this );
        };
    
    // Give the init function the jQuery prototype for later instantiation
    init.prototype = jQuery.fn;
    
    // Initialize central reference
    rootjQuery = jQuery( document );
    
    
    var rparentsprev = /^(?:parents|prev(?:Until|All))/,
    
        // Methods guaranteed to produce a unique set when starting from a unique set
        guaranteedUnique = {
            children: true,
            contents: true,
            next: true,
            prev: true
        };
    
    jQuery.fn.extend( {
        has: function( target ) {
            var targets = jQuery( target, this ),
                l = targets.length;
    
            return this.filter( function() {
                var i = 0;
                for ( ; i < l; i++ ) {
                    if ( jQuery.contains( this, targets[ i ] ) ) {
                        return true;
                    }
                }
            } );
        },
    
        closest: function( selectors, context ) {
            var cur,
                i = 0,
                l = this.length,
                matched = [],
                targets = typeof selectors !== "string" && jQuery( selectors );
    
            // Positional selectors never match, since there's no _selection_ context
            if ( !rneedsContext.test( selectors ) ) {
                for ( ; i < l; i++ ) {
                    for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {
    
                        // Always skip document fragments
                        if ( cur.nodeType < 11 && ( targets ?
                            targets.index( cur ) > -1 :
    
                            // Don't pass non-elements to Sizzle
                            cur.nodeType === 1 &&
                                jQuery.find.matchesSelector( cur, selectors ) ) ) {
    
                            matched.push( cur );
                            break;
                        }
                    }
                }
            }
    
            return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
        },
    
        // Determine the position of an element within the set
        index: function( elem ) {
    
            // No argument, return index in parent
            if ( !elem ) {
                return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
            }
    
            // Index in selector
            if ( typeof elem === "string" ) {
                return indexOf.call( jQuery( elem ), this[ 0 ] );
            }
    
            // Locate the position of the desired element
            return indexOf.call( this,
    
                // If it receives a jQuery object, the first element is used
                elem.jquery ? elem[ 0 ] : elem
            );
        },
    
        add: function( selector, context ) {
            return this.pushStack(
                jQuery.uniqueSort(
                    jQuery.merge( this.get(), jQuery( selector, context ) )
                )
            );
        },
    
        addBack: function( selector ) {
            return this.add( selector == null ?
                this.prevObject : this.prevObject.filter( selector )
            );
        }
    } );
    
    function sibling( cur, dir ) {
        while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
        return cur;
    }
    
    jQuery.each( {
        parent: function( elem ) {
            var parent = elem.parentNode;
            return parent && parent.nodeType !== 11 ? parent : null;
        },
        parents: function( elem ) {
            return dir( elem, "parentNode" );
        },
        parentsUntil: function( elem, i, until ) {
            return dir( elem, "parentNode", until );
        },
        next: function( elem ) {
            return sibling( elem, "nextSibling" );
        },
        prev: function( elem ) {
            return sibling( elem, "previousSibling" );
        },
        nextAll: function( elem ) {
            return dir( elem, "nextSibling" );
        },
        prevAll: function( elem ) {
            return dir( elem, "previousSibling" );
        },
        nextUntil: function( elem, i, until ) {
            return dir( elem, "nextSibling", until );
        },
        prevUntil: function( elem, i, until ) {
            return dir( elem, "previousSibling", until );
        },
        siblings: function( elem ) {
            return siblings( ( elem.parentNode || {} ).firstChild, elem );
        },
        children: function( elem ) {
            return siblings( elem.firstChild );
        },
        contents: function( elem ) {
            return elem.contentDocument || jQuery.merge( [], elem.childNodes );
        }
    }, function( name, fn ) {
        jQuery.fn[ name ] = function( until, selector ) {
            var matched = jQuery.map( this, fn, until );
    
            if ( name.slice( -5 ) !== "Until" ) {
                selector = until;
            }
    
            if ( selector && typeof selector === "string" ) {
                matched = jQuery.filter( selector, matched );
            }
    
            if ( this.length > 1 ) {
    
                // Remove duplicates
                if ( !guaranteedUnique[ name ] ) {
                    jQuery.uniqueSort( matched );
                }
    
                // Reverse order for parents* and prev-derivatives
                if ( rparentsprev.test( name ) ) {
                    matched.reverse();
                }
            }
    
            return this.pushStack( matched );
        };
    } );
    var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );
    
    
    
    // Convert String-formatted options into Object-formatted ones
    function createOptions( options ) {
        var object = {};
        jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
            object[ flag ] = true;
        } );
        return object;
    }
    
    /*
     * Create a callback list using the following parameters:
     *
     *	options: an optional list of space-separated options that will change how
     *			the callback list behaves or a more traditional option object
     *
     * By default a callback list will act like an event callback list and can be
     * "fired" multiple times.
     *
     * Possible options:
     *
     *	once:			will ensure the callback list can only be fired once (like a Deferred)
     *
     *	memory:			will keep track of previous values and will call any callback added
     *					after the list has been fired right away with the latest "memorized"
     *					values (like a Deferred)
     *
     *	unique:			will ensure a callback can only be added once (no duplicate in the list)
     *
     *	stopOnFalse:	interrupt callings when a callback returns false
     *
     */
    jQuery.Callbacks = function( options ) {
    
        // Convert options from String-formatted to Object-formatted if needed
        // (we check in cache first)
        options = typeof options === "string" ?
            createOptions( options ) :
            jQuery.extend( {}, options );
    
        var // Flag to know if list is currently firing
            firing,
    
            // Last fire value for non-forgettable lists
            memory,
    
            // Flag to know if list was already fired
            fired,
    
            // Flag to prevent firing
            locked,
    
            // Actual callback list
            list = [],
    
            // Queue of execution data for repeatable lists
            queue = [],
    
            // Index of currently firing callback (modified by add/remove as needed)
            firingIndex = -1,
    
            // Fire callbacks
            fire = function() {
    
                // Enforce single-firing
                locked = options.once;
    
                // Execute callbacks for all pending executions,
                // respecting firingIndex overrides and runtime changes
                fired = firing = true;
                for ( ; queue.length; firingIndex = -1 ) {
                    memory = queue.shift();
                    while ( ++firingIndex < list.length ) {
    
                        // Run callback and check for early termination
                        if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
                            options.stopOnFalse ) {
    
                            // Jump to end and forget the data so .add doesn't re-fire
                            firingIndex = list.length;
                            memory = false;
                        }
                    }
                }
    
                // Forget the data if we're done with it
                if ( !options.memory ) {
                    memory = false;
                }
    
                firing = false;
    
                // Clean up if we're done firing for good
                if ( locked ) {
    
                    // Keep an empty list if we have data for future add calls
                    if ( memory ) {
                        list = [];
    
                    // Otherwise, this object is spent
                    } else {
                        list = "";
                    }
                }
            },
    
            // Actual Callbacks object
            self = {
    
                // Add a callback or a collection of callbacks to the list
                add: function() {
                    if ( list ) {
    
                        // If we have memory from a past run, we should fire after adding
                        if ( memory && !firing ) {
                            firingIndex = list.length - 1;
                            queue.push( memory );
                        }
    
                        ( function add( args ) {
                            jQuery.each( args, function( _, arg ) {
                                if ( jQuery.isFunction( arg ) ) {
                                    if ( !options.unique || !self.has( arg ) ) {
                                        list.push( arg );
                                    }
                                } else if ( arg && arg.length && jQuery.type( arg ) !== "string" ) {
    
                                    // Inspect recursively
                                    add( arg );
                                }
                            } );
                        } )( arguments );
    
                        if ( memory && !firing ) {
                            fire();
                        }
                    }
                    return this;
                },
    
                // Remove a callback from the list
                remove: function() {
                    jQuery.each( arguments, function( _, arg ) {
                        var index;
                        while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
                            list.splice( index, 1 );
    
                            // Handle firing indexes
                            if ( index <= firingIndex ) {
                                firingIndex--;
                            }
                        }
                    } );
                    return this;
                },
    
                // Check if a given callback is in the list.
                // If no argument is given, return whether or not list has callbacks attached.
                has: function( fn ) {
                    return fn ?
                        jQuery.inArray( fn, list ) > -1 :
                        list.length > 0;
                },
    
                // Remove all callbacks from the list
                empty: function() {
                    if ( list ) {
                        list = [];
                    }
                    return this;
                },
    
                // Disable .fire and .add
                // Abort any current/pending executions
                // Clear all callbacks and values
                disable: function() {
                    locked = queue = [];
                    list = memory = "";
                    return this;
                },
                disabled: function() {
                    return !list;
                },
    
                // Disable .fire
                // Also disable .add unless we have memory (since it would have no effect)
                // Abort any pending executions
                lock: function() {
                    locked = queue = [];
                    if ( !memory && !firing ) {
                        list = memory = "";
                    }
                    return this;
                },
                locked: function() {
                    return !!locked;
                },
    
                // Call all callbacks with the given context and arguments
                fireWith: function( context, args ) {
                    if ( !locked ) {
                        args = args || [];
                        args = [ context, args.slice ? args.slice() : args ];
                        queue.push( args );
                        if ( !firing ) {
                            fire();
                        }
                    }
                    return this;
                },
    
                // Call all the callbacks with the given arguments
                fire: function() {
                    self.fireWith( this, arguments );
                    return this;
                },
    
                // To know if the callbacks have already been called at least once
                fired: function() {
                    return !!fired;
                }
            };
    
        return self;
    };
    
    
    function Identity( v ) {
        return v;
    }
    function Thrower( ex ) {
        throw ex;
    }
    
    function adoptValue( value, resolve, reject ) {
        var method;
    
        try {
    
            // Check for promise aspect first to privilege synchronous behavior
            if ( value && jQuery.isFunction( ( method = value.promise ) ) ) {
                method.call( value ).done( resolve ).fail( reject );
    
            // Other thenables
            } else if ( value && jQuery.isFunction( ( method = value.then ) ) ) {
                method.call( value, resolve, reject );
    
            // Other non-thenables
            } else {
    
                // Support: Android 4.0 only
                // Strict mode functions invoked without .call/.apply get global-object context
                resolve.call( undefined, value );
            }
    
        // For Promises/A+, convert exceptions into rejections
        // Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
        // Deferred#then to conditionally suppress rejection.
        } catch ( value ) {
    
            // Support: Android 4.0 only
            // Strict mode functions invoked without .call/.apply get global-object context
            reject.call( undefined, value );
        }
    }
    
    jQuery.extend( {
    
        Deferred: function( func ) {
            var tuples = [
    
                    // action, add listener, callbacks,
                    // ... .then handlers, argument index, [final state]
                    [ "notify", "progress", jQuery.Callbacks( "memory" ),
                        jQuery.Callbacks( "memory" ), 2 ],
                    [ "resolve", "done", jQuery.Callbacks( "once memory" ),
                        jQuery.Callbacks( "once memory" ), 0, "resolved" ],
                    [ "reject", "fail", jQuery.Callbacks( "once memory" ),
                        jQuery.Callbacks( "once memory" ), 1, "rejected" ]
                ],
                state = "pending",
                promise = {
                    state: function() {
                        return state;
                    },
                    always: function() {
                        deferred.done( arguments ).fail( arguments );
                        return this;
                    },
                    "catch": function( fn ) {
                        return promise.then( null, fn );
                    },
    
                    // Keep pipe for back-compat
                    pipe: function( /* fnDone, fnFail, fnProgress */ ) {
                        var fns = arguments;
    
                        return jQuery.Deferred( function( newDefer ) {
                            jQuery.each( tuples, function( i, tuple ) {
    
                                // Map tuples (progress, done, fail) to arguments (done, fail, progress)
                                var fn = jQuery.isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];
    
                                // deferred.progress(function() { bind to newDefer or newDefer.notify })
                                // deferred.done(function() { bind to newDefer or newDefer.resolve })
                                // deferred.fail(function() { bind to newDefer or newDefer.reject })
                                deferred[ tuple[ 1 ] ]( function() {
                                    var returned = fn && fn.apply( this, arguments );
                                    if ( returned && jQuery.isFunction( returned.promise ) ) {
                                        returned.promise()
                                            .progress( newDefer.notify )
                                            .done( newDefer.resolve )
                                            .fail( newDefer.reject );
                                    } else {
                                        newDefer[ tuple[ 0 ] + "With" ](
                                            this,
                                            fn ? [ returned ] : arguments
                                        );
                                    }
                                } );
                            } );
                            fns = null;
                        } ).promise();
                    },
                    then: function( onFulfilled, onRejected, onProgress ) {
                        var maxDepth = 0;
                        function resolve( depth, deferred, handler, special ) {
                            return function() {
                                var that = this,
                                    args = arguments,
                                    mightThrow = function() {
                                        var returned, then;
    
                                        // Support: Promises/A+ section 2.3.3.3.3
                                        // https://promisesaplus.com/#point-59
                                        // Ignore double-resolution attempts
                                        if ( depth < maxDepth ) {
                                            return;
                                        }
    
                                        returned = handler.apply( that, args );
    
                                        // Support: Promises/A+ section 2.3.1
                                        // https://promisesaplus.com/#point-48
                                        if ( returned === deferred.promise() ) {
                                            throw new TypeError( "Thenable self-resolution" );
                                        }
    
                                        // Support: Promises/A+ sections 2.3.3.1, 3.5
                                        // https://promisesaplus.com/#point-54
                                        // https://promisesaplus.com/#point-75
                                        // Retrieve `then` only once
                                        then = returned &&
    
                                            // Support: Promises/A+ section 2.3.4
                                            // https://promisesaplus.com/#point-64
                                            // Only check objects and functions for thenability
                                            ( typeof returned === "object" ||
                                                typeof returned === "function" ) &&
                                            returned.then;
    
                                        // Handle a returned thenable
                                        if ( jQuery.isFunction( then ) ) {
    
                                            // Special processors (notify) just wait for resolution
                                            if ( special ) {
                                                then.call(
                                                    returned,
                                                    resolve( maxDepth, deferred, Identity, special ),
                                                    resolve( maxDepth, deferred, Thrower, special )
                                                );
    
                                            // Normal processors (resolve) also hook into progress
                                            } else {
    
                                                // ...and disregard older resolution values
                                                maxDepth++;
    
                                                then.call(
                                                    returned,
                                                    resolve( maxDepth, deferred, Identity, special ),
                                                    resolve( maxDepth, deferred, Thrower, special ),
                                                    resolve( maxDepth, deferred, Identity,
                                                        deferred.notifyWith )
                                                );
                                            }
    
                                        // Handle all other returned values
                                        } else {
    
                                            // Only substitute handlers pass on context
                                            // and multiple values (non-spec behavior)
                                            if ( handler !== Identity ) {
                                                that = undefined;
                                                args = [ returned ];
                                            }
    
                                            // Process the value(s)
                                            // Default process is resolve
                                            ( special || deferred.resolveWith )( that, args );
                                        }
                                    },
    
                                    // Only normal processors (resolve) catch and reject exceptions
                                    process = special ?
                                        mightThrow :
                                        function() {
                                            try {
                                                mightThrow();
                                            } catch ( e ) {
    
                                                if ( jQuery.Deferred.exceptionHook ) {
                                                    jQuery.Deferred.exceptionHook( e,
                                                        process.stackTrace );
                                                }
    
                                                // Support: Promises/A+ section 2.3.3.3.4.1
                                                // https://promisesaplus.com/#point-61
                                                // Ignore post-resolution exceptions
                                                if ( depth + 1 >= maxDepth ) {
    
                                                    // Only substitute handlers pass on context
                                                    // and multiple values (non-spec behavior)
                                                    if ( handler !== Thrower ) {
                                                        that = undefined;
                                                        args = [ e ];
                                                    }
    
                                                    deferred.rejectWith( that, args );
                                                }
                                            }
                                        };
    
                                // Support: Promises/A+ section 2.3.3.3.1
                                // https://promisesaplus.com/#point-57
                                // Re-resolve promises immediately to dodge false rejection from
                                // subsequent errors
                                if ( depth ) {
                                    process();
                                } else {
    
                                    // Call an optional hook to record the stack, in case of exception
                                    // since it's otherwise lost when execution goes async
                                    if ( jQuery.Deferred.getStackHook ) {
                                        process.stackTrace = jQuery.Deferred.getStackHook();
                                    }
                                    window.setTimeout( process );
                                }
                            };
                        }
    
                        return jQuery.Deferred( function( newDefer ) {
    
                            // progress_handlers.add( ... )
                            tuples[ 0 ][ 3 ].add(
                                resolve(
                                    0,
                                    newDefer,
                                    jQuery.isFunction( onProgress ) ?
                                        onProgress :
                                        Identity,
                                    newDefer.notifyWith
                                )
                            );
    
                            // fulfilled_handlers.add( ... )
                            tuples[ 1 ][ 3 ].add(
                                resolve(
                                    0,
                                    newDefer,
                                    jQuery.isFunction( onFulfilled ) ?
                                        onFulfilled :
                                        Identity
                                )
                            );
    
                            // rejected_handlers.add( ... )
                            tuples[ 2 ][ 3 ].add(
                                resolve(
                                    0,
                                    newDefer,
                                    jQuery.isFunction( onRejected ) ?
                                        onRejected :
                                        Thrower
                                )
                            );
                        } ).promise();
                    },
    
                    // Get a promise for this deferred
                    // If obj is provided, the promise aspect is added to the object
                    promise: function( obj ) {
                        return obj != null ? jQuery.extend( obj, promise ) : promise;
                    }
                },
                deferred = {};
    
            // Add list-specific methods
            jQuery.each( tuples, function( i, tuple ) {
                var list = tuple[ 2 ],
                    stateString = tuple[ 5 ];
    
                // promise.progress = list.add
                // promise.done = list.add
                // promise.fail = list.add
                promise[ tuple[ 1 ] ] = list.add;
    
                // Handle state
                if ( stateString ) {
                    list.add(
                        function() {
    
                            // state = "resolved" (i.e., fulfilled)
                            // state = "rejected"
                            state = stateString;
                        },
    
                        // rejected_callbacks.disable
                        // fulfilled_callbacks.disable
                        tuples[ 3 - i ][ 2 ].disable,
    
                        // progress_callbacks.lock
                        tuples[ 0 ][ 2 ].lock
                    );
                }
    
                // progress_handlers.fire
                // fulfilled_handlers.fire
                // rejected_handlers.fire
                list.add( tuple[ 3 ].fire );
    
                // deferred.notify = function() { deferred.notifyWith(...) }
                // deferred.resolve = function() { deferred.resolveWith(...) }
                // deferred.reject = function() { deferred.rejectWith(...) }
                deferred[ tuple[ 0 ] ] = function() {
                    deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
                    return this;
                };
    
                // deferred.notifyWith = list.fireWith
                // deferred.resolveWith = list.fireWith
                // deferred.rejectWith = list.fireWith
                deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
            } );
    
            // Make the deferred a promise
            promise.promise( deferred );
    
            // Call given func if any
            if ( func ) {
                func.call( deferred, deferred );
            }
    
            // All done!
            return deferred;
        },
    
        // Deferred helper
        when: function( singleValue ) {
            var
    
                // count of uncompleted subordinates
                remaining = arguments.length,
    
                // count of unprocessed arguments
                i = remaining,
    
                // subordinate fulfillment data
                resolveContexts = Array( i ),
                resolveValues = slice.call( arguments ),
    
                // the master Deferred
                master = jQuery.Deferred(),
    
                // subordinate callback factory
                updateFunc = function( i ) {
                    return function( value ) {
                        resolveContexts[ i ] = this;
                        resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
                        if ( !( --remaining ) ) {
                            master.resolveWith( resolveContexts, resolveValues );
                        }
                    };
                };
    
            // Single- and empty arguments are adopted like Promise.resolve
            if ( remaining <= 1 ) {
                adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject );
    
                // Use .then() to unwrap secondary thenables (cf. gh-3000)
                if ( master.state() === "pending" ||
                    jQuery.isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {
    
                    return master.then();
                }
            }
    
            // Multiple arguments are aggregated like Promise.all array elements
            while ( i-- ) {
                adoptValue( resolveValues[ i ], updateFunc( i ), master.reject );
            }
    
            return master.promise();
        }
    } );
    
    
    // These usually indicate a programmer mistake during development,
    // warn about them ASAP rather than swallowing them by default.
    var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;
    
    jQuery.Deferred.exceptionHook = function( error, stack ) {
    
        // Support: IE 8 - 9 only
        // Console exists when dev tools are open, which can happen at any time
        if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
            window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
        }
    };
    
    
    
    
    jQuery.readyException = function( error ) {
        window.setTimeout( function() {
            throw error;
        } );
    };
    
    
    
    
    // The deferred used on DOM ready
    var readyList = jQuery.Deferred();
    
    jQuery.fn.ready = function( fn ) {
    
        readyList
            .then( fn )
    
            // Wrap jQuery.readyException in a function so that the lookup
            // happens at the time of error handling instead of callback
            // registration.
            .catch( function( error ) {
                jQuery.readyException( error );
            } );
    
        return this;
    };
    
    jQuery.extend( {
    
        // Is the DOM ready to be used? Set to true once it occurs.
        isReady: false,
    
        // A counter to track how many items to wait for before
        // the ready event fires. See #6781
        readyWait: 1,
    
        // Hold (or release) the ready event
        holdReady: function( hold ) {
            if ( hold ) {
                jQuery.readyWait++;
            } else {
                jQuery.ready( true );
            }
        },
    
        // Handle when the DOM is ready
        ready: function( wait ) {
    
            // Abort if there are pending holds or we're already ready
            if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
                return;
            }
    
            // Remember that the DOM is ready
            jQuery.isReady = true;
    
            // If a normal DOM Ready event fired, decrement, and wait if need be
            if ( wait !== true && --jQuery.readyWait > 0 ) {
                return;
            }
    
            // If there are functions bound, to execute
            readyList.resolveWith( document, [ jQuery ] );
        }
    } );
    
    jQuery.ready.then = readyList.then;
    
    // The ready event handler and self cleanup method
    function completed() {
        document.removeEventListener( "DOMContentLoaded", completed );
        window.removeEventListener( "load", completed );
        jQuery.ready();
    }
    
    // Catch cases where $(document).ready() is called
    // after the browser event has already occurred.
    // Support: IE <=9 - 10 only
    // Older IE sometimes signals "interactive" too soon
    if ( document.readyState === "complete" ||
        ( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {
    
        // Handle it asynchronously to allow scripts the opportunity to delay ready
        window.setTimeout( jQuery.ready );
    
    } else {
    
        // Use the handy event callback
        document.addEventListener( "DOMContentLoaded", completed );
    
        // A fallback to window.onload, that will always work
        window.addEventListener( "load", completed );
    }
    
    
    
    
    // Multifunctional method to get and set values of a collection
    // The value/s can optionally be executed if it's a function
    var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
        var i = 0,
            len = elems.length,
            bulk = key == null;
    
        // Sets many values
        if ( jQuery.type( key ) === "object" ) {
            chainable = true;
            for ( i in key ) {
                access( elems, fn, i, key[ i ], true, emptyGet, raw );
            }
    
        // Sets one value
        } else if ( value !== undefined ) {
            chainable = true;
    
            if ( !jQuery.isFunction( value ) ) {
                raw = true;
            }
    
            if ( bulk ) {
    
                // Bulk operations run against the entire set
                if ( raw ) {
                    fn.call( elems, value );
                    fn = null;
    
                // ...except when executing function values
                } else {
                    bulk = fn;
                    fn = function( elem, key, value ) {
                        return bulk.call( jQuery( elem ), value );
                    };
                }
            }
    
            if ( fn ) {
                for ( ; i < len; i++ ) {
                    fn(
                        elems[ i ], key, raw ?
                        value :
                        value.call( elems[ i ], i, fn( elems[ i ], key ) )
                    );
                }
            }
        }
    
        if ( chainable ) {
            return elems;
        }
    
        // Gets
        if ( bulk ) {
            return fn.call( elems );
        }
    
        return len ? fn( elems[ 0 ], key ) : emptyGet;
    };
    var acceptData = function( owner ) {
    
        // Accepts only:
        //  - Node
        //    - Node.ELEMENT_NODE
        //    - Node.DOCUMENT_NODE
        //  - Object
        //    - Any
        return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
    };
    
    
    
    
    function Data() {
        this.expando = jQuery.expando + Data.uid++;
    }
    
    Data.uid = 1;
    
    Data.prototype = {
    
        cache: function( owner ) {
    
            // Check if the owner object already has a cache
            var value = owner[ this.expando ];
    
            // If not, create one
            if ( !value ) {
                value = {};
    
                // We can accept data for non-element nodes in modern browsers,
                // but we should not, see #8335.
                // Always return an empty object.
                if ( acceptData( owner ) ) {
    
                    // If it is a node unlikely to be stringify-ed or looped over
                    // use plain assignment
                    if ( owner.nodeType ) {
                        owner[ this.expando ] = value;
    
                    // Otherwise secure it in a non-enumerable property
                    // configurable must be true to allow the property to be
                    // deleted when data is removed
                    } else {
                        Object.defineProperty( owner, this.expando, {
                            value: value,
                            configurable: true
                        } );
                    }
                }
            }
    
            return value;
        },
        set: function( owner, data, value ) {
            var prop,
                cache = this.cache( owner );
    
            // Handle: [ owner, key, value ] args
            // Always use camelCase key (gh-2257)
            if ( typeof data === "string" ) {
                cache[ jQuery.camelCase( data ) ] = value;
    
            // Handle: [ owner, { properties } ] args
            } else {
    
                // Copy the properties one-by-one to the cache object
                for ( prop in data ) {
                    cache[ jQuery.camelCase( prop ) ] = data[ prop ];
                }
            }
            return cache;
        },
        get: function( owner, key ) {
            return key === undefined ?
                this.cache( owner ) :
    
                // Always use camelCase key (gh-2257)
                owner[ this.expando ] && owner[ this.expando ][ jQuery.camelCase( key ) ];
        },
        access: function( owner, key, value ) {
    
            // In cases where either:
            //
            //   1. No key was specified
            //   2. A string key was specified, but no value provided
            //
            // Take the "read" path and allow the get method to determine
            // which value to return, respectively either:
            //
            //   1. The entire cache object
            //   2. The data stored at the key
            //
            if ( key === undefined ||
                    ( ( key && typeof key === "string" ) && value === undefined ) ) {
    
                return this.get( owner, key );
            }
    
            // When the key is not a string, or both a key and value
            // are specified, set or extend (existing objects) with either:
            //
            //   1. An object of properties
            //   2. A key and value
            //
            this.set( owner, key, value );
    
            // Since the "set" path can have two possible entry points
            // return the expected data based on which path was taken[*]
            return value !== undefined ? value : key;
        },
        remove: function( owner, key ) {
            var i,
                cache = owner[ this.expando ];
    
            if ( cache === undefined ) {
                return;
            }
    
            if ( key !== undefined ) {
    
                // Support array or space separated string of keys
                if ( jQuery.isArray( key ) ) {
    
                    // If key is an array of keys...
                    // We always set camelCase keys, so remove that.
                    key = key.map( jQuery.camelCase );
                } else {
                    key = jQuery.camelCase( key );
    
                    // If a key with the spaces exists, use it.
                    // Otherwise, create an array by matching non-whitespace
                    key = key in cache ?
                        [ key ] :
                        ( key.match( rnothtmlwhite ) || [] );
                }
    
                i = key.length;
    
                while ( i-- ) {
                    delete cache[ key[ i ] ];
                }
            }
    
            // Remove the expando if there's no more data
            if ( key === undefined || jQuery.isEmptyObject( cache ) ) {
    
                // Support: Chrome <=35 - 45
                // Webkit & Blink performance suffers when deleting properties
                // from DOM nodes, so set to undefined instead
                // https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
                if ( owner.nodeType ) {
                    owner[ this.expando ] = undefined;
                } else {
                    delete owner[ this.expando ];
                }
            }
        },
        hasData: function( owner ) {
            var cache = owner[ this.expando ];
            return cache !== undefined && !jQuery.isEmptyObject( cache );
        }
    };
    var dataPriv = new Data();
    
    var dataUser = new Data();
    
    
    
    //	Implementation Summary
    //
    //	1. Enforce API surface and semantic compatibility with 1.9.x branch
    //	2. Improve the module's maintainability by reducing the storage
    //		paths to a single mechanism.
    //	3. Use the same single mechanism to support "private" and "user" data.
    //	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
    //	5. Avoid exposing implementation details on user objects (eg. expando properties)
    //	6. Provide a clear path for implementation upgrade to WeakMap in 2014
    
    var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
        rmultiDash = /[A-Z]/g;
    
    function getData( data ) {
        if ( data === "true" ) {
            return true;
        }
    
        if ( data === "false" ) {
            return false;
        }
    
        if ( data === "null" ) {
            return null;
        }
    
        // Only convert to a number if it doesn't change the string
        if ( data === +data + "" ) {
            return +data;
        }
    
        if ( rbrace.test( data ) ) {
            return JSON.parse( data );
        }
    
        return data;
    }
    
    function dataAttr( elem, key, data ) {
        var name;
    
        // If nothing was found internally, try to fetch any
        // data from the HTML5 data-* attribute
        if ( data === undefined && elem.nodeType === 1 ) {
            name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
            data = elem.getAttribute( name );
    
            if ( typeof data === "string" ) {
                try {
                    data = getData( data );
                } catch ( e ) {}
    
                // Make sure we set the data so it isn't changed later
                dataUser.set( elem, key, data );
            } else {
                data = undefined;
            }
        }
        return data;
    }
    
    jQuery.extend( {
        hasData: function( elem ) {
            return dataUser.hasData( elem ) || dataPriv.hasData( elem );
        },
    
        data: function( elem, name, data ) {
            return dataUser.access( elem, name, data );
        },
    
        removeData: function( elem, name ) {
            dataUser.remove( elem, name );
        },
    
        // TODO: Now that all calls to _data and _removeData have been replaced
        // with direct calls to dataPriv methods, these can be deprecated.
        _data: function( elem, name, data ) {
            return dataPriv.access( elem, name, data );
        },
    
        _removeData: function( elem, name ) {
            dataPriv.remove( elem, name );
        }
    } );
    
    jQuery.fn.extend( {
        data: function( key, value ) {
            var i, name, data,
                elem = this[ 0 ],
                attrs = elem && elem.attributes;
    
            // Gets all values
            if ( key === undefined ) {
                if ( this.length ) {
                    data = dataUser.get( elem );
    
                    if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
                        i = attrs.length;
                        while ( i-- ) {
    
                            // Support: IE 11 only
                            // The attrs elements can be null (#14894)
                            if ( attrs[ i ] ) {
                                name = attrs[ i ].name;
                                if ( name.indexOf( "data-" ) === 0 ) {
                                    name = jQuery.camelCase( name.slice( 5 ) );
                                    dataAttr( elem, name, data[ name ] );
                                }
                            }
                        }
                        dataPriv.set( elem, "hasDataAttrs", true );
                    }
                }
    
                return data;
            }
    
            // Sets multiple values
            if ( typeof key === "object" ) {
                return this.each( function() {
                    dataUser.set( this, key );
                } );
            }
    
            return access( this, function( value ) {
                var data;
    
                // The calling jQuery object (element matches) is not empty
                // (and therefore has an element appears at this[ 0 ]) and the
                // `value` parameter was not undefined. An empty jQuery object
                // will result in `undefined` for elem = this[ 0 ] which will
                // throw an exception if an attempt to read a data cache is made.
                if ( elem && value === undefined ) {
    
                    // Attempt to get data from the cache
                    // The key will always be camelCased in Data
                    data = dataUser.get( elem, key );
                    if ( data !== undefined ) {
                        return data;
                    }
    
                    // Attempt to "discover" the data in
                    // HTML5 custom data-* attrs
                    data = dataAttr( elem, key );
                    if ( data !== undefined ) {
                        return data;
                    }
    
                    // We tried really hard, but the data doesn't exist.
                    return;
                }
    
                // Set the data...
                this.each( function() {
    
                    // We always store the camelCased key
                    dataUser.set( this, key, value );
                } );
            }, null, value, arguments.length > 1, null, true );
        },
    
        removeData: function( key ) {
            return this.each( function() {
                dataUser.remove( this, key );
            } );
        }
    } );
    
    
    jQuery.extend( {
        queue: function( elem, type, data ) {
            var queue;
    
            if ( elem ) {
                type = ( type || "fx" ) + "queue";
                queue = dataPriv.get( elem, type );
    
                // Speed up dequeue by getting out quickly if this is just a lookup
                if ( data ) {
                    if ( !queue || jQuery.isArray( data ) ) {
                        queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
                    } else {
                        queue.push( data );
                    }
                }
                return queue || [];
            }
        },
    
        dequeue: function( elem, type ) {
            type = type || "fx";
    
            var queue = jQuery.queue( elem, type ),
                startLength = queue.length,
                fn = queue.shift(),
                hooks = jQuery._queueHooks( elem, type ),
                next = function() {
                    jQuery.dequeue( elem, type );
                };
    
            // If the fx queue is dequeued, always remove the progress sentinel
            if ( fn === "inprogress" ) {
                fn = queue.shift();
                startLength--;
            }
    
            if ( fn ) {
    
                // Add a progress sentinel to prevent the fx queue from being
                // automatically dequeued
                if ( type === "fx" ) {
                    queue.unshift( "inprogress" );
                }
    
                // Clear up the last queue stop function
                delete hooks.stop;
                fn.call( elem, next, hooks );
            }
    
            if ( !startLength && hooks ) {
                hooks.empty.fire();
            }
        },
    
        // Not public - generate a queueHooks object, or return the current one
        _queueHooks: function( elem, type ) {
            var key = type + "queueHooks";
            return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
                empty: jQuery.Callbacks( "once memory" ).add( function() {
                    dataPriv.remove( elem, [ type + "queue", key ] );
                } )
            } );
        }
    } );
    
    jQuery.fn.extend( {
        queue: function( type, data ) {
            var setter = 2;
    
            if ( typeof type !== "string" ) {
                data = type;
                type = "fx";
                setter--;
            }
    
            if ( arguments.length < setter ) {
                return jQuery.queue( this[ 0 ], type );
            }
    
            return data === undefined ?
                this :
                this.each( function() {
                    var queue = jQuery.queue( this, type, data );
    
                    // Ensure a hooks for this queue
                    jQuery._queueHooks( this, type );
    
                    if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
                        jQuery.dequeue( this, type );
                    }
                } );
        },
        dequeue: function( type ) {
            return this.each( function() {
                jQuery.dequeue( this, type );
            } );
        },
        clearQueue: function( type ) {
            return this.queue( type || "fx", [] );
        },
    
        // Get a promise resolved when queues of a certain type
        // are emptied (fx is the type by default)
        promise: function( type, obj ) {
            var tmp,
                count = 1,
                defer = jQuery.Deferred(),
                elements = this,
                i = this.length,
                resolve = function() {
                    if ( !( --count ) ) {
                        defer.resolveWith( elements, [ elements ] );
                    }
                };
    
            if ( typeof type !== "string" ) {
                obj = type;
                type = undefined;
            }
            type = type || "fx";
    
            while ( i-- ) {
                tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
                if ( tmp && tmp.empty ) {
                    count++;
                    tmp.empty.add( resolve );
                }
            }
            resolve();
            return defer.promise( obj );
        }
    } );
    var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;
    
    var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );
    
    
    var cssExpand = [ "Top", "Right", "Bottom", "Left" ];
    
    var isHiddenWithinTree = function( elem, el ) {
    
            // isHiddenWithinTree might be called from jQuery#filter function;
            // in that case, element will be second argument
            elem = el || elem;
    
            // Inline style trumps all
            return elem.style.display === "none" ||
                elem.style.display === "" &&
    
                // Otherwise, check computed style
                // Support: Firefox <=43 - 45
                // Disconnected elements can have computed display: none, so first confirm that elem is
                // in the document.
                jQuery.contains( elem.ownerDocument, elem ) &&
    
                jQuery.css( elem, "display" ) === "none";
        };
    
    var swap = function( elem, options, callback, args ) {
        var ret, name,
            old = {};
    
        // Remember the old values, and insert the new ones
        for ( name in options ) {
            old[ name ] = elem.style[ name ];
            elem.style[ name ] = options[ name ];
        }
    
        ret = callback.apply( elem, args || [] );
    
        // Revert the old values
        for ( name in options ) {
            elem.style[ name ] = old[ name ];
        }
    
        return ret;
    };
    
    
    
    
    function adjustCSS( elem, prop, valueParts, tween ) {
        var adjusted,
            scale = 1,
            maxIterations = 20,
            currentValue = tween ?
                function() {
                    return tween.cur();
                } :
                function() {
                    return jQuery.css( elem, prop, "" );
                },
            initial = currentValue(),
            unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),
    
            // Starting value computation is required for potential unit mismatches
            initialInUnit = ( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
                rcssNum.exec( jQuery.css( elem, prop ) );
    
        if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {
    
            // Trust units reported by jQuery.css
            unit = unit || initialInUnit[ 3 ];
    
            // Make sure we update the tween properties later on
            valueParts = valueParts || [];
    
            // Iteratively approximate from a nonzero starting point
            initialInUnit = +initial || 1;
    
            do {
    
                // If previous iteration zeroed out, double until we get *something*.
                // Use string for doubling so we don't accidentally see scale as unchanged below
                scale = scale || ".5";
    
                // Adjust and apply
                initialInUnit = initialInUnit / scale;
                jQuery.style( elem, prop, initialInUnit + unit );
    
            // Update scale, tolerating zero or NaN from tween.cur()
            // Break the loop if scale is unchanged or perfect, or if we've just had enough.
            } while (
                scale !== ( scale = currentValue() / initial ) && scale !== 1 && --maxIterations
            );
        }
    
        if ( valueParts ) {
            initialInUnit = +initialInUnit || +initial || 0;
    
            // Apply relative offset (+=/-=) if specified
            adjusted = valueParts[ 1 ] ?
                initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
                +valueParts[ 2 ];
            if ( tween ) {
                tween.unit = unit;
                tween.start = initialInUnit;
                tween.end = adjusted;
            }
        }
        return adjusted;
    }
    
    
    var defaultDisplayMap = {};
    
    function getDefaultDisplay( elem ) {
        var temp,
            doc = elem.ownerDocument,
            nodeName = elem.nodeName,
            display = defaultDisplayMap[ nodeName ];
    
        if ( display ) {
            return display;
        }
    
        temp = doc.body.appendChild( doc.createElement( nodeName ) );
        display = jQuery.css( temp, "display" );
    
        temp.parentNode.removeChild( temp );
    
        if ( display === "none" ) {
            display = "block";
        }
        defaultDisplayMap[ nodeName ] = display;
    
        return display;
    }
    
    function showHide( elements, show ) {
        var display, elem,
            values = [],
            index = 0,
            length = elements.length;
    
        // Determine new display value for elements that need to change
        for ( ; index < length; index++ ) {
            elem = elements[ index ];
            if ( !elem.style ) {
                continue;
            }
    
            display = elem.style.display;
            if ( show ) {
    
                // Since we force visibility upon cascade-hidden elements, an immediate (and slow)
                // check is required in this first loop unless we have a nonempty display value (either
                // inline or about-to-be-restored)
                if ( display === "none" ) {
                    values[ index ] = dataPriv.get( elem, "display" ) || null;
                    if ( !values[ index ] ) {
                        elem.style.display = "";
                    }
                }
                if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
                    values[ index ] = getDefaultDisplay( elem );
                }
            } else {
                if ( display !== "none" ) {
                    values[ index ] = "none";
    
                    // Remember what we're overwriting
                    dataPriv.set( elem, "display", display );
                }
            }
        }
    
        // Set the display of the elements in a second loop to avoid constant reflow
        for ( index = 0; index < length; index++ ) {
            if ( values[ index ] != null ) {
                elements[ index ].style.display = values[ index ];
            }
        }
    
        return elements;
    }
    
    jQuery.fn.extend( {
        show: function() {
            return showHide( this, true );
        },
        hide: function() {
            return showHide( this );
        },
        toggle: function( state ) {
            if ( typeof state === "boolean" ) {
                return state ? this.show() : this.hide();
            }
    
            return this.each( function() {
                if ( isHiddenWithinTree( this ) ) {
                    jQuery( this ).show();
                } else {
                    jQuery( this ).hide();
                }
            } );
        }
    } );
    var rcheckableType = ( /^(?:checkbox|radio)$/i );
    
    var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]+)/i );
    
    var rscriptType = ( /^$|\/(?:java|ecma)script/i );
    
    
    
    // We have to close these tags to support XHTML (#13200)
    var wrapMap = {
    
        // Support: IE <=9 only
        option: [ 1, "<select multiple='multiple'>", "</select>" ],
    
        // XHTML parsers do not magically insert elements in the
        // same way that tag soup parsers do. So we cannot shorten
        // this by omitting <tbody> or other required elements.
        thead: [ 1, "<table>", "</table>" ],
        col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
        tr: [ 2, "<table><tbody>", "</tbody></table>" ],
        td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
    
        _default: [ 0, "", "" ]
    };
    
    // Support: IE <=9 only
    wrapMap.optgroup = wrapMap.option;
    
    wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
    wrapMap.th = wrapMap.td;
    
    
    function getAll( context, tag ) {
    
        // Support: IE <=9 - 11 only
        // Use typeof to avoid zero-argument method invocation on host objects (#15151)
        var ret;
    
        if ( typeof context.getElementsByTagName !== "undefined" ) {
            ret = context.getElementsByTagName( tag || "*" );
    
        } else if ( typeof context.querySelectorAll !== "undefined" ) {
            ret = context.querySelectorAll( tag || "*" );
    
        } else {
            ret = [];
        }
    
        if ( tag === undefined || tag && jQuery.nodeName( context, tag ) ) {
            return jQuery.merge( [ context ], ret );
        }
    
        return ret;
    }
    
    
    // Mark scripts as having already been evaluated
    function setGlobalEval( elems, refElements ) {
        var i = 0,
            l = elems.length;
    
        for ( ; i < l; i++ ) {
            dataPriv.set(
                elems[ i ],
                "globalEval",
                !refElements || dataPriv.get( refElements[ i ], "globalEval" )
            );
        }
    }
    
    
    var rhtml = /<|&#?\w+;/;
    
    function buildFragment( elems, context, scripts, selection, ignored ) {
        var elem, tmp, tag, wrap, contains, j,
            fragment = context.createDocumentFragment(),
            nodes = [],
            i = 0,
            l = elems.length;
    
        for ( ; i < l; i++ ) {
            elem = elems[ i ];
    
            if ( elem || elem === 0 ) {
    
                // Add nodes directly
                if ( jQuery.type( elem ) === "object" ) {
    
                    // Support: Android <=4.0 only, PhantomJS 1 only
                    // push.apply(_, arraylike) throws on ancient WebKit
                    jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );
    
                // Convert non-html into a text node
                } else if ( !rhtml.test( elem ) ) {
                    nodes.push( context.createTextNode( elem ) );
    
                // Convert html into DOM nodes
                } else {
                    tmp = tmp || fragment.appendChild( context.createElement( "div" ) );
    
                    // Deserialize a standard representation
                    tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
                    wrap = wrapMap[ tag ] || wrapMap._default;
                    tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];
    
                    // Descend through wrappers to the right content
                    j = wrap[ 0 ];
                    while ( j-- ) {
                        tmp = tmp.lastChild;
                    }
    
                    // Support: Android <=4.0 only, PhantomJS 1 only
                    // push.apply(_, arraylike) throws on ancient WebKit
                    jQuery.merge( nodes, tmp.childNodes );
    
                    // Remember the top-level container
                    tmp = fragment.firstChild;
    
                    // Ensure the created nodes are orphaned (#12392)
                    tmp.textContent = "";
                }
            }
        }
    
        // Remove wrapper from fragment
        fragment.textContent = "";
    
        i = 0;
        while ( ( elem = nodes[ i++ ] ) ) {
    
            // Skip elements already in the context collection (trac-4087)
            if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
                if ( ignored ) {
                    ignored.push( elem );
                }
                continue;
            }
    
            contains = jQuery.contains( elem.ownerDocument, elem );
    
            // Append to fragment
            tmp = getAll( fragment.appendChild( elem ), "script" );
    
            // Preserve script evaluation history
            if ( contains ) {
                setGlobalEval( tmp );
            }
    
            // Capture executables
            if ( scripts ) {
                j = 0;
                while ( ( elem = tmp[ j++ ] ) ) {
                    if ( rscriptType.test( elem.type || "" ) ) {
                        scripts.push( elem );
                    }
                }
            }
        }
    
        return fragment;
    }
    
    
    ( function() {
        var fragment = document.createDocumentFragment(),
            div = fragment.appendChild( document.createElement( "div" ) ),
            input = document.createElement( "input" );
    
        // Support: Android 4.0 - 4.3 only
        // Check state lost if the name is set (#11217)
        // Support: Windows Web Apps (WWA)
        // `name` and `type` must use .setAttribute for WWA (#14901)
        input.setAttribute( "type", "radio" );
        input.setAttribute( "checked", "checked" );
        input.setAttribute( "name", "t" );
    
        div.appendChild( input );
    
        // Support: Android <=4.1 only
        // Older WebKit doesn't clone checked state correctly in fragments
        support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;
    
        // Support: IE <=11 only
        // Make sure textarea (and checkbox) defaultValue is properly cloned
        div.innerHTML = "<textarea>x</textarea>";
        support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
    } )();
    var documentElement = document.documentElement;
    
    
    
    var
        rkeyEvent = /^key/,
        rmouseEvent = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
        rtypenamespace = /^([^.]*)(?:\.(.+)|)/;
    
    function returnTrue() {
        return true;
    }
    
    function returnFalse() {
        return false;
    }
    
    // Support: IE <=9 only
    // See #13393 for more info
    function safeActiveElement() {
        try {
            return document.activeElement;
        } catch ( err ) { }
    }
    
    function on( elem, types, selector, data, fn, one ) {
        var origFn, type;
    
        // Types can be a map of types/handlers
        if ( typeof types === "object" ) {
    
            // ( types-Object, selector, data )
            if ( typeof selector !== "string" ) {
    
                // ( types-Object, data )
                data = data || selector;
                selector = undefined;
            }
            for ( type in types ) {
                on( elem, type, selector, data, types[ type ], one );
            }
            return elem;
        }
    
        if ( data == null && fn == null ) {
    
            // ( types, fn )
            fn = selector;
            data = selector = undefined;
        } else if ( fn == null ) {
            if ( typeof selector === "string" ) {
    
                // ( types, selector, fn )
                fn = data;
                data = undefined;
            } else {
    
                // ( types, data, fn )
                fn = data;
                data = selector;
                selector = undefined;
            }
        }
        if ( fn === false ) {
            fn = returnFalse;
        } else if ( !fn ) {
            return elem;
        }
    
        if ( one === 1 ) {
            origFn = fn;
            fn = function( event ) {
    
                // Can use an empty set, since event contains the info
                jQuery().off( event );
                return origFn.apply( this, arguments );
            };
    
            // Use same guid so caller can remove using origFn
            fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
        }
        return elem.each( function() {
            jQuery.event.add( this, types, fn, data, selector );
        } );
    }
    
    /*
     * Helper functions for managing events -- not part of the public interface.
     * Props to Dean Edwards' addEvent library for many of the ideas.
     */
    jQuery.event = {
    
        global: {},
    
        add: function( elem, types, handler, data, selector ) {
    
            var handleObjIn, eventHandle, tmp,
                events, t, handleObj,
                special, handlers, type, namespaces, origType,
                elemData = dataPriv.get( elem );
    
            // Don't attach events to noData or text/comment nodes (but allow plain objects)
            if ( !elemData ) {
                return;
            }
    
            // Caller can pass in an object of custom data in lieu of the handler
            if ( handler.handler ) {
                handleObjIn = handler;
                handler = handleObjIn.handler;
                selector = handleObjIn.selector;
            }
    
            // Ensure that invalid selectors throw exceptions at attach time
            // Evaluate against documentElement in case elem is a non-element node (e.g., document)
            if ( selector ) {
                jQuery.find.matchesSelector( documentElement, selector );
            }
    
            // Make sure that the handler has a unique ID, used to find/remove it later
            if ( !handler.guid ) {
                handler.guid = jQuery.guid++;
            }
    
            // Init the element's event structure and main handler, if this is the first
            if ( !( events = elemData.events ) ) {
                events = elemData.events = {};
            }
            if ( !( eventHandle = elemData.handle ) ) {
                eventHandle = elemData.handle = function( e ) {
    
                    // Discard the second event of a jQuery.event.trigger() and
                    // when an event is called after a page has unloaded
                    return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
                        jQuery.event.dispatch.apply( elem, arguments ) : undefined;
                };
            }
    
            // Handle multiple events separated by a space
            types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
            t = types.length;
            while ( t-- ) {
                tmp = rtypenamespace.exec( types[ t ] ) || [];
                type = origType = tmp[ 1 ];
                namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();
    
                // There *must* be a type, no attaching namespace-only handlers
                if ( !type ) {
                    continue;
                }
    
                // If event changes its type, use the special event handlers for the changed type
                special = jQuery.event.special[ type ] || {};
    
                // If selector defined, determine special event api type, otherwise given type
                type = ( selector ? special.delegateType : special.bindType ) || type;
    
                // Update special based on newly reset type
                special = jQuery.event.special[ type ] || {};
    
                // handleObj is passed to all event handlers
                handleObj = jQuery.extend( {
                    type: type,
                    origType: origType,
                    data: data,
                    handler: handler,
                    guid: handler.guid,
                    selector: selector,
                    needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
                    namespace: namespaces.join( "." )
                }, handleObjIn );
    
                // Init the event handler queue if we're the first
                if ( !( handlers = events[ type ] ) ) {
                    handlers = events[ type ] = [];
                    handlers.delegateCount = 0;
    
                    // Only use addEventListener if the special events handler returns false
                    if ( !special.setup ||
                        special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
    
                        if ( elem.addEventListener ) {
                            elem.addEventListener( type, eventHandle );
                        }
                    }
                }
    
                if ( special.add ) {
                    special.add.call( elem, handleObj );
    
                    if ( !handleObj.handler.guid ) {
                        handleObj.handler.guid = handler.guid;
                    }
                }
    
                // Add to the element's handler list, delegates in front
                if ( selector ) {
                    handlers.splice( handlers.delegateCount++, 0, handleObj );
                } else {
                    handlers.push( handleObj );
                }
    
                // Keep track of which events have ever been used, for event optimization
                jQuery.event.global[ type ] = true;
            }
    
        },
    
        // Detach an event or set of events from an element
        remove: function( elem, types, handler, selector, mappedTypes ) {
    
            var j, origCount, tmp,
                events, t, handleObj,
                special, handlers, type, namespaces, origType,
                elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );
    
            if ( !elemData || !( events = elemData.events ) ) {
                return;
            }
    
            // Once for each type.namespace in types; type may be omitted
            types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
            t = types.length;
            while ( t-- ) {
                tmp = rtypenamespace.exec( types[ t ] ) || [];
                type = origType = tmp[ 1 ];
                namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();
    
                // Unbind all events (on this namespace, if provided) for the element
                if ( !type ) {
                    for ( type in events ) {
                        jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
                    }
                    continue;
                }
    
                special = jQuery.event.special[ type ] || {};
                type = ( selector ? special.delegateType : special.bindType ) || type;
                handlers = events[ type ] || [];
                tmp = tmp[ 2 ] &&
                    new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );
    
                // Remove matching events
                origCount = j = handlers.length;
                while ( j-- ) {
                    handleObj = handlers[ j ];
    
                    if ( ( mappedTypes || origType === handleObj.origType ) &&
                        ( !handler || handler.guid === handleObj.guid ) &&
                        ( !tmp || tmp.test( handleObj.namespace ) ) &&
                        ( !selector || selector === handleObj.selector ||
                            selector === "**" && handleObj.selector ) ) {
                        handlers.splice( j, 1 );
    
                        if ( handleObj.selector ) {
                            handlers.delegateCount--;
                        }
                        if ( special.remove ) {
                            special.remove.call( elem, handleObj );
                        }
                    }
                }
    
                // Remove generic event handler if we removed something and no more handlers exist
                // (avoids potential for endless recursion during removal of special event handlers)
                if ( origCount && !handlers.length ) {
                    if ( !special.teardown ||
                        special.teardown.call( elem, namespaces, elemData.handle ) === false ) {
    
                        jQuery.removeEvent( elem, type, elemData.handle );
                    }
    
                    delete events[ type ];
                }
            }
    
            // Remove data and the expando if it's no longer used
            if ( jQuery.isEmptyObject( events ) ) {
                dataPriv.remove( elem, "handle events" );
            }
        },
    
        dispatch: function( nativeEvent ) {
    
            // Make a writable jQuery.Event from the native event object
            var event = jQuery.event.fix( nativeEvent );
    
            var i, j, ret, matched, handleObj, handlerQueue,
                args = new Array( arguments.length ),
                handlers = ( dataPriv.get( this, "events" ) || {} )[ event.type ] || [],
                special = jQuery.event.special[ event.type ] || {};
    
            // Use the fix-ed jQuery.Event rather than the (read-only) native event
            args[ 0 ] = event;
    
            for ( i = 1; i < arguments.length; i++ ) {
                args[ i ] = arguments[ i ];
            }
    
            event.delegateTarget = this;
    
            // Call the preDispatch hook for the mapped type, and let it bail if desired
            if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
                return;
            }
    
            // Determine handlers
            handlerQueue = jQuery.event.handlers.call( this, event, handlers );
    
            // Run delegates first; they may want to stop propagation beneath us
            i = 0;
            while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
                event.currentTarget = matched.elem;
    
                j = 0;
                while ( ( handleObj = matched.handlers[ j++ ] ) &&
                    !event.isImmediatePropagationStopped() ) {
    
                    // Triggered event must either 1) have no namespace, or 2) have namespace(s)
                    // a subset or equal to those in the bound event (both can have no namespace).
                    if ( !event.rnamespace || event.rnamespace.test( handleObj.namespace ) ) {
    
                        event.handleObj = handleObj;
                        event.data = handleObj.data;
    
                        ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
                            handleObj.handler ).apply( matched.elem, args );
    
                        if ( ret !== undefined ) {
                            if ( ( event.result = ret ) === false ) {
                                event.preventDefault();
                                event.stopPropagation();
                            }
                        }
                    }
                }
            }
    
            // Call the postDispatch hook for the mapped type
            if ( special.postDispatch ) {
                special.postDispatch.call( this, event );
            }
    
            return event.result;
        },
    
        handlers: function( event, handlers ) {
            var i, handleObj, sel, matchedHandlers, matchedSelectors,
                handlerQueue = [],
                delegateCount = handlers.delegateCount,
                cur = event.target;
    
            // Find delegate handlers
            if ( delegateCount &&
    
                // Support: IE <=9
                // Black-hole SVG <use> instance trees (trac-13180)
                cur.nodeType &&
    
                // Support: Firefox <=42
                // Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
                // https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
                // Support: IE 11 only
                // ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
                !( event.type === "click" && event.button >= 1 ) ) {
    
                for ( ; cur !== this; cur = cur.parentNode || this ) {
    
                    // Don't check non-elements (#13208)
                    // Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
                    if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
                        matchedHandlers = [];
                        matchedSelectors = {};
                        for ( i = 0; i < delegateCount; i++ ) {
                            handleObj = handlers[ i ];
    
                            // Don't conflict with Object.prototype properties (#13203)
                            sel = handleObj.selector + " ";
    
                            if ( matchedSelectors[ sel ] === undefined ) {
                                matchedSelectors[ sel ] = handleObj.needsContext ?
                                    jQuery( sel, this ).index( cur ) > -1 :
                                    jQuery.find( sel, this, null, [ cur ] ).length;
                            }
                            if ( matchedSelectors[ sel ] ) {
                                matchedHandlers.push( handleObj );
                            }
                        }
                        if ( matchedHandlers.length ) {
                            handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
                        }
                    }
                }
            }
    
            // Add the remaining (directly-bound) handlers
            cur = this;
            if ( delegateCount < handlers.length ) {
                handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
            }
    
            return handlerQueue;
        },
    
        addProp: function( name, hook ) {
            Object.defineProperty( jQuery.Event.prototype, name, {
                enumerable: true,
                configurable: true,
    
                get: jQuery.isFunction( hook ) ?
                    function() {
                        if ( this.originalEvent ) {
                                return hook( this.originalEvent );
                        }
                    } :
                    function() {
                        if ( this.originalEvent ) {
                                return this.originalEvent[ name ];
                        }
                    },
    
                set: function( value ) {
                    Object.defineProperty( this, name, {
                        enumerable: true,
                        configurable: true,
                        writable: true,
                        value: value
                    } );
                }
            } );
        },
    
        fix: function( originalEvent ) {
            return originalEvent[ jQuery.expando ] ?
                originalEvent :
                new jQuery.Event( originalEvent );
        },
    
        special: {
            load: {
    
                // Prevent triggered image.load events from bubbling to window.load
                noBubble: true
            },
            focus: {
    
                // Fire native event if possible so blur/focus sequence is correct
                trigger: function() {
                    if ( this !== safeActiveElement() && this.focus ) {
                        this.focus();
                        return false;
                    }
                },
                delegateType: "focusin"
            },
            blur: {
                trigger: function() {
                    if ( this === safeActiveElement() && this.blur ) {
                        this.blur();
                        return false;
                    }
                },
                delegateType: "focusout"
            },
            click: {
    
                // For checkbox, fire native event so checked state will be right
                trigger: function() {
                    if ( this.type === "checkbox" && this.click && jQuery.nodeName( this, "input" ) ) {
                        this.click();
                        return false;
                    }
                },
    
                // For cross-browser consistency, don't fire native .click() on links
                _default: function( event ) {
                    return jQuery.nodeName( event.target, "a" );
                }
            },
    
            beforeunload: {
                postDispatch: function( event ) {
    
                    // Support: Firefox 20+
                    // Firefox doesn't alert if the returnValue field is not set.
                    if ( event.result !== undefined && event.originalEvent ) {
                        event.originalEvent.returnValue = event.result;
                    }
                }
            }
        }
    };
    
    jQuery.removeEvent = function( elem, type, handle ) {
    
        // This "if" is needed for plain objects
        if ( elem.removeEventListener ) {
            elem.removeEventListener( type, handle );
        }
    };
    
    jQuery.Event = function( src, props ) {
    
        // Allow instantiation without the 'new' keyword
        if ( !( this instanceof jQuery.Event ) ) {
            return new jQuery.Event( src, props );
        }
    
        // Event object
        if ( src && src.type ) {
            this.originalEvent = src;
            this.type = src.type;
    
            // Events bubbling up the document may have been marked as prevented
            // by a handler lower down the tree; reflect the correct value.
            this.isDefaultPrevented = src.defaultPrevented ||
                    src.defaultPrevented === undefined &&
    
                    // Support: Android <=2.3 only
                    src.returnValue === false ?
                returnTrue :
                returnFalse;
    
            // Create target properties
            // Support: Safari <=6 - 7 only
            // Target should not be a text node (#504, #13143)
            this.target = ( src.target && src.target.nodeType === 3 ) ?
                src.target.parentNode :
                src.target;
    
            this.currentTarget = src.currentTarget;
            this.relatedTarget = src.relatedTarget;
    
        // Event type
        } else {
            this.type = src;
        }
    
        // Put explicitly provided properties onto the event object
        if ( props ) {
            jQuery.extend( this, props );
        }
    
        // Create a timestamp if incoming event doesn't have one
        this.timeStamp = src && src.timeStamp || jQuery.now();
    
        // Mark it as fixed
        this[ jQuery.expando ] = true;
    };
    
    // jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
    // https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
    jQuery.Event.prototype = {
        constructor: jQuery.Event,
        isDefaultPrevented: returnFalse,
        isPropagationStopped: returnFalse,
        isImmediatePropagationStopped: returnFalse,
        isSimulated: false,
    
        preventDefault: function() {
            var e = this.originalEvent;
    
            this.isDefaultPrevented = returnTrue;
    
            if ( e && !this.isSimulated ) {
                e.preventDefault();
            }
        },
        stopPropagation: function() {
            var e = this.originalEvent;
    
            this.isPropagationStopped = returnTrue;
    
            if ( e && !this.isSimulated ) {
                e.stopPropagation();
            }
        },
        stopImmediatePropagation: function() {
            var e = this.originalEvent;
    
            this.isImmediatePropagationStopped = returnTrue;
    
            if ( e && !this.isSimulated ) {
                e.stopImmediatePropagation();
            }
    
            this.stopPropagation();
        }
    };
    
    // Includes all common event props including KeyEvent and MouseEvent specific props
    jQuery.each( {
        altKey: true,
        bubbles: true,
        cancelable: true,
        changedTouches: true,
        ctrlKey: true,
        detail: true,
        eventPhase: true,
        metaKey: true,
        pageX: true,
        pageY: true,
        shiftKey: true,
        view: true,
        "char": true,
        charCode: true,
        key: true,
        keyCode: true,
        button: true,
        buttons: true,
        clientX: true,
        clientY: true,
        offsetX: true,
        offsetY: true,
        pointerId: true,
        pointerType: true,
        screenX: true,
        screenY: true,
        targetTouches: true,
        toElement: true,
        touches: true,
    
        which: function( event ) {
            var button = event.button;
    
            // Add which for key events
            if ( event.which == null && rkeyEvent.test( event.type ) ) {
                return event.charCode != null ? event.charCode : event.keyCode;
            }
    
            // Add which for click: 1 === left; 2 === middle; 3 === right
            if ( !event.which && button !== undefined && rmouseEvent.test( event.type ) ) {
                if ( button & 1 ) {
                    return 1;
                }
    
                if ( button & 2 ) {
                    return 3;
                }
    
                if ( button & 4 ) {
                    return 2;
                }
    
                return 0;
            }
    
            return event.which;
        }
    }, jQuery.event.addProp );
    
    // Create mouseenter/leave events using mouseover/out and event-time checks
    // so that event delegation works in jQuery.
    // Do the same for pointerenter/pointerleave and pointerover/pointerout
    //
    // Support: Safari 7 only
    // Safari sends mouseenter too often; see:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=470258
    // for the description of the bug (it existed in older Chrome versions as well).
    jQuery.each( {
        mouseenter: "mouseover",
        mouseleave: "mouseout",
        pointerenter: "pointerover",
        pointerleave: "pointerout"
    }, function( orig, fix ) {
        jQuery.event.special[ orig ] = {
            delegateType: fix,
            bindType: fix,
    
            handle: function( event ) {
                var ret,
                    target = this,
                    related = event.relatedTarget,
                    handleObj = event.handleObj;
    
                // For mouseenter/leave call the handler if related is outside the target.
                // NB: No relatedTarget if the mouse left/entered the browser window
                if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
                    event.type = handleObj.origType;
                    ret = handleObj.handler.apply( this, arguments );
                    event.type = fix;
                }
                return ret;
            }
        };
    } );
    
    jQuery.fn.extend( {
    
        on: function( types, selector, data, fn ) {
            return on( this, types, selector, data, fn );
        },
        one: function( types, selector, data, fn ) {
            return on( this, types, selector, data, fn, 1 );
        },
        off: function( types, selector, fn ) {
            var handleObj, type;
            if ( types && types.preventDefault && types.handleObj ) {
    
                // ( event )  dispatched jQuery.Event
                handleObj = types.handleObj;
                jQuery( types.delegateTarget ).off(
                    handleObj.namespace ?
                        handleObj.origType + "." + handleObj.namespace :
                        handleObj.origType,
                    handleObj.selector,
                    handleObj.handler
                );
                return this;
            }
            if ( typeof types === "object" ) {
    
                // ( types-object [, selector] )
                for ( type in types ) {
                    this.off( type, selector, types[ type ] );
                }
                return this;
            }
            if ( selector === false || typeof selector === "function" ) {
    
                // ( types [, fn] )
                fn = selector;
                selector = undefined;
            }
            if ( fn === false ) {
                fn = returnFalse;
            }
            return this.each( function() {
                jQuery.event.remove( this, types, fn, selector );
            } );
        }
    } );
    
    
    var
    
        /* eslint-disable max-len */
    
        // See https://github.com/eslint/eslint/issues/3229
        rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,
    
        /* eslint-enable */
    
        // Support: IE <=10 - 11, Edge 12 - 13
        // In IE/Edge using regex groups here causes severe slowdowns.
        // See https://connect.microsoft.com/IE/feedback/details/1736512/
        rnoInnerhtml = /<script|<style|<link/i,
    
        // checked="checked" or checked
        rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
        rscriptTypeMasked = /^true\/(.*)/,
        rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;
    
    function manipulationTarget( elem, content ) {
        if ( jQuery.nodeName( elem, "table" ) &&
            jQuery.nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {
    
            return elem.getElementsByTagName( "tbody" )[ 0 ] || elem;
        }
    
        return elem;
    }
    
    // Replace/restore the type attribute of script elements for safe DOM manipulation
    function disableScript( elem ) {
        elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
        return elem;
    }
    function restoreScript( elem ) {
        var match = rscriptTypeMasked.exec( elem.type );
    
        if ( match ) {
            elem.type = match[ 1 ];
        } else {
            elem.removeAttribute( "type" );
        }
    
        return elem;
    }
    
    function cloneCopyEvent( src, dest ) {
        var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;
    
        if ( dest.nodeType !== 1 ) {
            return;
        }
    
        // 1. Copy private data: events, handlers, etc.
        if ( dataPriv.hasData( src ) ) {
            pdataOld = dataPriv.access( src );
            pdataCur = dataPriv.set( dest, pdataOld );
            events = pdataOld.events;
    
            if ( events ) {
                delete pdataCur.handle;
                pdataCur.events = {};
    
                for ( type in events ) {
                    for ( i = 0, l = events[ type ].length; i < l; i++ ) {
                        jQuery.event.add( dest, type, events[ type ][ i ] );
                    }
                }
            }
        }
    
        // 2. Copy user data
        if ( dataUser.hasData( src ) ) {
            udataOld = dataUser.access( src );
            udataCur = jQuery.extend( {}, udataOld );
    
            dataUser.set( dest, udataCur );
        }
    }
    
    // Fix IE bugs, see support tests
    function fixInput( src, dest ) {
        var nodeName = dest.nodeName.toLowerCase();
    
        // Fails to persist the checked state of a cloned checkbox or radio button.
        if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
            dest.checked = src.checked;
    
        // Fails to return the selected option to the default selected state when cloning options
        } else if ( nodeName === "input" || nodeName === "textarea" ) {
            dest.defaultValue = src.defaultValue;
        }
    }
    
    function domManip( collection, args, callback, ignored ) {
    
        // Flatten any nested arrays
        args = concat.apply( [], args );
    
        var fragment, first, scripts, hasScripts, node, doc,
            i = 0,
            l = collection.length,
            iNoClone = l - 1,
            value = args[ 0 ],
            isFunction = jQuery.isFunction( value );
    
        // We can't cloneNode fragments that contain checked, in WebKit
        if ( isFunction ||
                ( l > 1 && typeof value === "string" &&
                    !support.checkClone && rchecked.test( value ) ) ) {
            return collection.each( function( index ) {
                var self = collection.eq( index );
                if ( isFunction ) {
                    args[ 0 ] = value.call( this, index, self.html() );
                }
                domManip( self, args, callback, ignored );
            } );
        }
    
        if ( l ) {
            fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
            first = fragment.firstChild;
    
            if ( fragment.childNodes.length === 1 ) {
                fragment = first;
            }
    
            // Require either new content or an interest in ignored elements to invoke the callback
            if ( first || ignored ) {
                scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
                hasScripts = scripts.length;
    
                // Use the original fragment for the last item
                // instead of the first because it can end up
                // being emptied incorrectly in certain situations (#8070).
                for ( ; i < l; i++ ) {
                    node = fragment;
    
                    if ( i !== iNoClone ) {
                        node = jQuery.clone( node, true, true );
    
                        // Keep references to cloned scripts for later restoration
                        if ( hasScripts ) {
    
                            // Support: Android <=4.0 only, PhantomJS 1 only
                            // push.apply(_, arraylike) throws on ancient WebKit
                            jQuery.merge( scripts, getAll( node, "script" ) );
                        }
                    }
    
                    callback.call( collection[ i ], node, i );
                }
    
                if ( hasScripts ) {
                    doc = scripts[ scripts.length - 1 ].ownerDocument;
    
                    // Reenable scripts
                    jQuery.map( scripts, restoreScript );
    
                    // Evaluate executable scripts on first document insertion
                    for ( i = 0; i < hasScripts; i++ ) {
                        node = scripts[ i ];
                        if ( rscriptType.test( node.type || "" ) &&
                            !dataPriv.access( node, "globalEval" ) &&
                            jQuery.contains( doc, node ) ) {
    
                            if ( node.src ) {
    
                                // Optional AJAX dependency, but won't run scripts if not present
                                if ( jQuery._evalUrl ) {
                                    jQuery._evalUrl( node.src );
                                }
                            } else {
                                DOMEval( node.textContent.replace( rcleanScript, "" ), doc );
                            }
                        }
                    }
                }
            }
        }
    
        return collection;
    }
    
    function remove( elem, selector, keepData ) {
        var node,
            nodes = selector ? jQuery.filter( selector, elem ) : elem,
            i = 0;
    
        for ( ; ( node = nodes[ i ] ) != null; i++ ) {
            if ( !keepData && node.nodeType === 1 ) {
                jQuery.cleanData( getAll( node ) );
            }
    
            if ( node.parentNode ) {
                if ( keepData && jQuery.contains( node.ownerDocument, node ) ) {
                    setGlobalEval( getAll( node, "script" ) );
                }
                node.parentNode.removeChild( node );
            }
        }
    
        return elem;
    }
    
    jQuery.extend( {
        htmlPrefilter: function( html ) {
            return html.replace( rxhtmlTag, "<$1></$2>" );
        },
    
        clone: function( elem, dataAndEvents, deepDataAndEvents ) {
            var i, l, srcElements, destElements,
                clone = elem.cloneNode( true ),
                inPage = jQuery.contains( elem.ownerDocument, elem );
    
            // Fix IE cloning issues
            if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
                    !jQuery.isXMLDoc( elem ) ) {
    
                // We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
                destElements = getAll( clone );
                srcElements = getAll( elem );
    
                for ( i = 0, l = srcElements.length; i < l; i++ ) {
                    fixInput( srcElements[ i ], destElements[ i ] );
                }
            }
    
            // Copy the events from the original to the clone
            if ( dataAndEvents ) {
                if ( deepDataAndEvents ) {
                    srcElements = srcElements || getAll( elem );
                    destElements = destElements || getAll( clone );
    
                    for ( i = 0, l = srcElements.length; i < l; i++ ) {
                        cloneCopyEvent( srcElements[ i ], destElements[ i ] );
                    }
                } else {
                    cloneCopyEvent( elem, clone );
                }
            }
    
            // Preserve script evaluation history
            destElements = getAll( clone, "script" );
            if ( destElements.length > 0 ) {
                setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
            }
    
            // Return the cloned set
            return clone;
        },
    
        cleanData: function( elems ) {
            var data, elem, type,
                special = jQuery.event.special,
                i = 0;
    
            for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
                if ( acceptData( elem ) ) {
                    if ( ( data = elem[ dataPriv.expando ] ) ) {
                        if ( data.events ) {
                            for ( type in data.events ) {
                                if ( special[ type ] ) {
                                    jQuery.event.remove( elem, type );
    
                                // This is a shortcut to avoid jQuery.event.remove's overhead
                                } else {
                                    jQuery.removeEvent( elem, type, data.handle );
                                }
                            }
                        }
    
                        // Support: Chrome <=35 - 45+
                        // Assign undefined instead of using delete, see Data#remove
                        elem[ dataPriv.expando ] = undefined;
                    }
                    if ( elem[ dataUser.expando ] ) {
    
                        // Support: Chrome <=35 - 45+
                        // Assign undefined instead of using delete, see Data#remove
                        elem[ dataUser.expando ] = undefined;
                    }
                }
            }
        }
    } );
    
    jQuery.fn.extend( {
        detach: function( selector ) {
            return remove( this, selector, true );
        },
    
        remove: function( selector ) {
            return remove( this, selector );
        },
    
        text: function( value ) {
            return access( this, function( value ) {
                return value === undefined ?
                    jQuery.text( this ) :
                    this.empty().each( function() {
                        if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
                            this.textContent = value;
                        }
                    } );
            }, null, value, arguments.length );
        },
    
        append: function() {
            return domManip( this, arguments, function( elem ) {
                if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
                    var target = manipulationTarget( this, elem );
                    target.appendChild( elem );
                }
            } );
        },
    
        prepend: function() {
            return domManip( this, arguments, function( elem ) {
                if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
                    var target = manipulationTarget( this, elem );
                    target.insertBefore( elem, target.firstChild );
                }
            } );
        },
    
        before: function() {
            return domManip( this, arguments, function( elem ) {
                if ( this.parentNode ) {
                    this.parentNode.insertBefore( elem, this );
                }
            } );
        },
    
        after: function() {
            return domManip( this, arguments, function( elem ) {
                if ( this.parentNode ) {
                    this.parentNode.insertBefore( elem, this.nextSibling );
                }
            } );
        },
    
        empty: function() {
            var elem,
                i = 0;
    
            for ( ; ( elem = this[ i ] ) != null; i++ ) {
                if ( elem.nodeType === 1 ) {
    
                    // Prevent memory leaks
                    jQuery.cleanData( getAll( elem, false ) );
    
                    // Remove any remaining nodes
                    elem.textContent = "";
                }
            }
    
            return this;
        },
    
        clone: function( dataAndEvents, deepDataAndEvents ) {
            dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
            deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;
    
            return this.map( function() {
                return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
            } );
        },
    
        html: function( value ) {
            return access( this, function( value ) {
                var elem = this[ 0 ] || {},
                    i = 0,
                    l = this.length;
    
                if ( value === undefined && elem.nodeType === 1 ) {
                    return elem.innerHTML;
                }
    
                // See if we can take a shortcut and just use innerHTML
                if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
                    !wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {
    
                    value = jQuery.htmlPrefilter( value );
    
                    try {
                        for ( ; i < l; i++ ) {
                            elem = this[ i ] || {};
    
                            // Remove element nodes and prevent memory leaks
                            if ( elem.nodeType === 1 ) {
                                jQuery.cleanData( getAll( elem, false ) );
                                elem.innerHTML = value;
                            }
                        }
    
                        elem = 0;
    
                    // If using innerHTML throws an exception, use the fallback method
                    } catch ( e ) {}
                }
    
                if ( elem ) {
                    this.empty().append( value );
                }
            }, null, value, arguments.length );
        },
    
        replaceWith: function() {
            var ignored = [];
    
            // Make the changes, replacing each non-ignored context element with the new content
            return domManip( this, arguments, function( elem ) {
                var parent = this.parentNode;
    
                if ( jQuery.inArray( this, ignored ) < 0 ) {
                    jQuery.cleanData( getAll( this ) );
                    if ( parent ) {
                        parent.replaceChild( elem, this );
                    }
                }
    
            // Force callback invocation
            }, ignored );
        }
    } );
    
    jQuery.each( {
        appendTo: "append",
        prependTo: "prepend",
        insertBefore: "before",
        insertAfter: "after",
        replaceAll: "replaceWith"
    }, function( name, original ) {
        jQuery.fn[ name ] = function( selector ) {
            var elems,
                ret = [],
                insert = jQuery( selector ),
                last = insert.length - 1,
                i = 0;
    
            for ( ; i <= last; i++ ) {
                elems = i === last ? this : this.clone( true );
                jQuery( insert[ i ] )[ original ]( elems );
    
                // Support: Android <=4.0 only, PhantomJS 1 only
                // .get() because push.apply(_, arraylike) throws on ancient WebKit
                push.apply( ret, elems.get() );
            }
    
            return this.pushStack( ret );
        };
    } );
    var rmargin = ( /^margin/ );
    
    var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );
    
    var getStyles = function( elem ) {
    
            // Support: IE <=11 only, Firefox <=30 (#15098, #14150)
            // IE throws on elements created in popups
            // FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
            var view = elem.ownerDocument.defaultView;
    
            if ( !view || !view.opener ) {
                view = window;
            }
    
            return view.getComputedStyle( elem );
        };
    
    
    
    ( function() {
    
        // Executing both pixelPosition & boxSizingReliable tests require only one layout
        // so they're executed at the same time to save the second computation.
        function computeStyleTests() {
    
            // This is a singleton, we need to execute it only once
            if ( !div ) {
                return;
            }
    
            div.style.cssText =
                "box-sizing:border-box;" +
                "position:relative;display:block;" +
                "margin:auto;border:1px;padding:1px;" +
                "top:1%;width:50%";
            div.innerHTML = "";
            documentElement.appendChild( container );
    
            var divStyle = window.getComputedStyle( div );
            pixelPositionVal = divStyle.top !== "1%";
    
            // Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
            reliableMarginLeftVal = divStyle.marginLeft === "2px";
            boxSizingReliableVal = divStyle.width === "4px";
    
            // Support: Android 4.0 - 4.3 only
            // Some styles come back with percentage values, even though they shouldn't
            div.style.marginRight = "50%";
            pixelMarginRightVal = divStyle.marginRight === "4px";
    
            documentElement.removeChild( container );
    
            // Nullify the div so it wouldn't be stored in the memory and
            // it will also be a sign that checks already performed
            div = null;
        }
    
        var pixelPositionVal, boxSizingReliableVal, pixelMarginRightVal, reliableMarginLeftVal,
            container = document.createElement( "div" ),
            div = document.createElement( "div" );
    
        // Finish early in limited (non-browser) environments
        if ( !div.style ) {
            return;
        }
    
        // Support: IE <=9 - 11 only
        // Style of cloned element affects source element cloned (#8908)
        div.style.backgroundClip = "content-box";
        div.cloneNode( true ).style.backgroundClip = "";
        support.clearCloneStyle = div.style.backgroundClip === "content-box";
    
        container.style.cssText = "border:0;width:8px;height:0;top:0;left:-9999px;" +
            "padding:0;margin-top:1px;position:absolute";
        container.appendChild( div );
    
        jQuery.extend( support, {
            pixelPosition: function() {
                computeStyleTests();
                return pixelPositionVal;
            },
            boxSizingReliable: function() {
                computeStyleTests();
                return boxSizingReliableVal;
            },
            pixelMarginRight: function() {
                computeStyleTests();
                return pixelMarginRightVal;
            },
            reliableMarginLeft: function() {
                computeStyleTests();
                return reliableMarginLeftVal;
            }
        } );
    } )();
    
    
    function curCSS( elem, name, computed ) {
        var width, minWidth, maxWidth, ret,
            style = elem.style;
    
        computed = computed || getStyles( elem );
    
        // Support: IE <=9 only
        // getPropertyValue is only needed for .css('filter') (#12537)
        if ( computed ) {
            ret = computed.getPropertyValue( name ) || computed[ name ];
    
            if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
                ret = jQuery.style( elem, name );
            }
    
            // A tribute to the "awesome hack by Dean Edwards"
            // Android Browser returns percentage for some values,
            // but width seems to be reliably pixels.
            // This is against the CSSOM draft spec:
            // https://drafts.csswg.org/cssom/#resolved-values
            if ( !support.pixelMarginRight() && rnumnonpx.test( ret ) && rmargin.test( name ) ) {
    
                // Remember the original values
                width = style.width;
                minWidth = style.minWidth;
                maxWidth = style.maxWidth;
    
                // Put in the new values to get a computed value out
                style.minWidth = style.maxWidth = style.width = ret;
                ret = computed.width;
    
                // Revert the changed values
                style.width = width;
                style.minWidth = minWidth;
                style.maxWidth = maxWidth;
            }
        }
    
        return ret !== undefined ?
    
            // Support: IE <=9 - 11 only
            // IE returns zIndex value as an integer.
            ret + "" :
            ret;
    }
    
    
    function addGetHookIf( conditionFn, hookFn ) {
    
        // Define the hook, we'll check on the first run if it's really needed.
        return {
            get: function() {
                if ( conditionFn() ) {
    
                    // Hook not needed (or it's not possible to use it due
                    // to missing dependency), remove it.
                    delete this.get;
                    return;
                }
    
                // Hook needed; redefine it so that the support test is not executed again.
                return ( this.get = hookFn ).apply( this, arguments );
            }
        };
    }
    
    
    var
    
        // Swappable if display is none or starts with table
        // except "table", "table-cell", or "table-caption"
        // See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
        rdisplayswap = /^(none|table(?!-c[ea]).+)/,
        cssShow = { position: "absolute", visibility: "hidden", display: "block" },
        cssNormalTransform = {
            letterSpacing: "0",
            fontWeight: "400"
        },
    
        cssPrefixes = [ "Webkit", "Moz", "ms" ],
        emptyStyle = document.createElement( "div" ).style;
    
    // Return a css property mapped to a potentially vendor prefixed property
    function vendorPropName( name ) {
    
        // Shortcut for names that are not vendor prefixed
        if ( name in emptyStyle ) {
            return name;
        }
    
        // Check for vendor prefixed names
        var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
            i = cssPrefixes.length;
    
        while ( i-- ) {
            name = cssPrefixes[ i ] + capName;
            if ( name in emptyStyle ) {
                return name;
            }
        }
    }
    
    function setPositiveNumber( elem, value, subtract ) {
    
        // Any relative (+/-) values have already been
        // normalized at this point
        var matches = rcssNum.exec( value );
        return matches ?
    
            // Guard against undefined "subtract", e.g., when used as in cssHooks
            Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
            value;
    }
    
    function augmentWidthOrHeight( elem, name, extra, isBorderBox, styles ) {
        var i,
            val = 0;
    
        // If we already have the right measurement, avoid augmentation
        if ( extra === ( isBorderBox ? "border" : "content" ) ) {
            i = 4;
    
        // Otherwise initialize for horizontal or vertical properties
        } else {
            i = name === "width" ? 1 : 0;
        }
    
        for ( ; i < 4; i += 2 ) {
    
            // Both box models exclude margin, so add it if we want it
            if ( extra === "margin" ) {
                val += jQuery.css( elem, extra + cssExpand[ i ], true, styles );
            }
    
            if ( isBorderBox ) {
    
                // border-box includes padding, so remove it if we want content
                if ( extra === "content" ) {
                    val -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
                }
    
                // At this point, extra isn't border nor margin, so remove border
                if ( extra !== "margin" ) {
                    val -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
                }
            } else {
    
                // At this point, extra isn't content, so add padding
                val += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
    
                // At this point, extra isn't content nor padding, so add border
                if ( extra !== "padding" ) {
                    val += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
                }
            }
        }
    
        return val;
    }
    
    function getWidthOrHeight( elem, name, extra ) {
    
        // Start with offset property, which is equivalent to the border-box value
        var val,
            valueIsBorderBox = true,
            styles = getStyles( elem ),
            isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";
    
        // Support: IE <=11 only
        // Running getBoundingClientRect on a disconnected node
        // in IE throws an error.
        if ( elem.getClientRects().length ) {
            val = elem.getBoundingClientRect()[ name ];
        }
    
        // Some non-html elements return undefined for offsetWidth, so check for null/undefined
        // svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
        // MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
        if ( val <= 0 || val == null ) {
    
            // Fall back to computed then uncomputed css if necessary
            val = curCSS( elem, name, styles );
            if ( val < 0 || val == null ) {
                val = elem.style[ name ];
            }
    
            // Computed unit is not pixels. Stop here and return.
            if ( rnumnonpx.test( val ) ) {
                return val;
            }
    
            // Check for style in case a browser which returns unreliable values
            // for getComputedStyle silently falls back to the reliable elem.style
            valueIsBorderBox = isBorderBox &&
                ( support.boxSizingReliable() || val === elem.style[ name ] );
    
            // Normalize "", auto, and prepare for extra
            val = parseFloat( val ) || 0;
        }
    
        // Use the active box-sizing model to add/subtract irrelevant styles
        return ( val +
            augmentWidthOrHeight(
                elem,
                name,
                extra || ( isBorderBox ? "border" : "content" ),
                valueIsBorderBox,
                styles
            )
        ) + "px";
    }
    
    jQuery.extend( {
    
        // Add in style property hooks for overriding the default
        // behavior of getting and setting a style property
        cssHooks: {
            opacity: {
                get: function( elem, computed ) {
                    if ( computed ) {
    
                        // We should always get a number back from opacity
                        var ret = curCSS( elem, "opacity" );
                        return ret === "" ? "1" : ret;
                    }
                }
            }
        },
    
        // Don't automatically add "px" to these possibly-unitless properties
        cssNumber: {
            "animationIterationCount": true,
            "columnCount": true,
            "fillOpacity": true,
            "flexGrow": true,
            "flexShrink": true,
            "fontWeight": true,
            "lineHeight": true,
            "opacity": true,
            "order": true,
            "orphans": true,
            "widows": true,
            "zIndex": true,
            "zoom": true
        },
    
        // Add in properties whose names you wish to fix before
        // setting or getting the value
        cssProps: {
            "float": "cssFloat"
        },
    
        // Get and set the style property on a DOM Node
        style: function( elem, name, value, extra ) {
    
            // Don't set styles on text and comment nodes
            if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
                return;
            }
    
            // Make sure that we're working with the right name
            var ret, type, hooks,
                origName = jQuery.camelCase( name ),
                style = elem.style;
    
            name = jQuery.cssProps[ origName ] ||
                ( jQuery.cssProps[ origName ] = vendorPropName( origName ) || origName );
    
            // Gets hook for the prefixed version, then unprefixed version
            hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];
    
            // Check if we're setting a value
            if ( value !== undefined ) {
                type = typeof value;
    
                // Convert "+=" or "-=" to relative numbers (#7345)
                if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
                    value = adjustCSS( elem, name, ret );
    
                    // Fixes bug #9237
                    type = "number";
                }
    
                // Make sure that null and NaN values aren't set (#7116)
                if ( value == null || value !== value ) {
                    return;
                }
    
                // If a number was passed in, add the unit (except for certain CSS properties)
                if ( type === "number" ) {
                    value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
                }
    
                // background-* props affect original clone's values
                if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
                    style[ name ] = "inherit";
                }
    
                // If a hook was provided, use that value, otherwise just set the specified value
                if ( !hooks || !( "set" in hooks ) ||
                    ( value = hooks.set( elem, value, extra ) ) !== undefined ) {
    
                    style[ name ] = value;
                }
    
            } else {
    
                // If a hook was provided get the non-computed value from there
                if ( hooks && "get" in hooks &&
                    ( ret = hooks.get( elem, false, extra ) ) !== undefined ) {
    
                    return ret;
                }
    
                // Otherwise just get the value from the style object
                return style[ name ];
            }
        },
    
        css: function( elem, name, extra, styles ) {
            var val, num, hooks,
                origName = jQuery.camelCase( name );
    
            // Make sure that we're working with the right name
            name = jQuery.cssProps[ origName ] ||
                ( jQuery.cssProps[ origName ] = vendorPropName( origName ) || origName );
    
            // Try prefixed name followed by the unprefixed name
            hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];
    
            // If a hook was provided get the computed value from there
            if ( hooks && "get" in hooks ) {
                val = hooks.get( elem, true, extra );
            }
    
            // Otherwise, if a way to get the computed value exists, use that
            if ( val === undefined ) {
                val = curCSS( elem, name, styles );
            }
    
            // Convert "normal" to computed value
            if ( val === "normal" && name in cssNormalTransform ) {
                val = cssNormalTransform[ name ];
            }
    
            // Make numeric if forced or a qualifier was provided and val looks numeric
            if ( extra === "" || extra ) {
                num = parseFloat( val );
                return extra === true || isFinite( num ) ? num || 0 : val;
            }
            return val;
        }
    } );
    
    jQuery.each( [ "height", "width" ], function( i, name ) {
        jQuery.cssHooks[ name ] = {
            get: function( elem, computed, extra ) {
                if ( computed ) {
    
                    // Certain elements can have dimension info if we invisibly show them
                    // but it must have a current display style that would benefit
                    return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&
    
                        // Support: Safari 8+
                        // Table columns in Safari have non-zero offsetWidth & zero
                        // getBoundingClientRect().width unless display is changed.
                        // Support: IE <=11 only
                        // Running getBoundingClientRect on a disconnected node
                        // in IE throws an error.
                        ( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
                            swap( elem, cssShow, function() {
                                return getWidthOrHeight( elem, name, extra );
                            } ) :
                            getWidthOrHeight( elem, name, extra );
                }
            },
    
            set: function( elem, value, extra ) {
                var matches,
                    styles = extra && getStyles( elem ),
                    subtract = extra && augmentWidthOrHeight(
                        elem,
                        name,
                        extra,
                        jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
                        styles
                    );
    
                // Convert to pixels if value adjustment is needed
                if ( subtract && ( matches = rcssNum.exec( value ) ) &&
                    ( matches[ 3 ] || "px" ) !== "px" ) {
    
                    elem.style[ name ] = value;
                    value = jQuery.css( elem, name );
                }
    
                return setPositiveNumber( elem, value, subtract );
            }
        };
    } );
    
    jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
        function( elem, computed ) {
            if ( computed ) {
                return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
                    elem.getBoundingClientRect().left -
                        swap( elem, { marginLeft: 0 }, function() {
                            return elem.getBoundingClientRect().left;
                        } )
                    ) + "px";
            }
        }
    );
    
    // These hooks are used by animate to expand properties
    jQuery.each( {
        margin: "",
        padding: "",
        border: "Width"
    }, function( prefix, suffix ) {
        jQuery.cssHooks[ prefix + suffix ] = {
            expand: function( value ) {
                var i = 0,
                    expanded = {},
    
                    // Assumes a single number if not a string
                    parts = typeof value === "string" ? value.split( " " ) : [ value ];
    
                for ( ; i < 4; i++ ) {
                    expanded[ prefix + cssExpand[ i ] + suffix ] =
                        parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
                }
    
                return expanded;
            }
        };
    
        if ( !rmargin.test( prefix ) ) {
            jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
        }
    } );
    
    jQuery.fn.extend( {
        css: function( name, value ) {
            return access( this, function( elem, name, value ) {
                var styles, len,
                    map = {},
                    i = 0;
    
                if ( jQuery.isArray( name ) ) {
                    styles = getStyles( elem );
                    len = name.length;
    
                    for ( ; i < len; i++ ) {
                        map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
                    }
    
                    return map;
                }
    
                return value !== undefined ?
                    jQuery.style( elem, name, value ) :
                    jQuery.css( elem, name );
            }, name, value, arguments.length > 1 );
        }
    } );
    
    
    function Tween( elem, options, prop, end, easing ) {
        return new Tween.prototype.init( elem, options, prop, end, easing );
    }
    jQuery.Tween = Tween;
    
    Tween.prototype = {
        constructor: Tween,
        init: function( elem, options, prop, end, easing, unit ) {
            this.elem = elem;
            this.prop = prop;
            this.easing = easing || jQuery.easing._default;
            this.options = options;
            this.start = this.now = this.cur();
            this.end = end;
            this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
        },
        cur: function() {
            var hooks = Tween.propHooks[ this.prop ];
    
            return hooks && hooks.get ?
                hooks.get( this ) :
                Tween.propHooks._default.get( this );
        },
        run: function( percent ) {
            var eased,
                hooks = Tween.propHooks[ this.prop ];
    
            if ( this.options.duration ) {
                this.pos = eased = jQuery.easing[ this.easing ](
                    percent, this.options.duration * percent, 0, 1, this.options.duration
                );
            } else {
                this.pos = eased = percent;
            }
            this.now = ( this.end - this.start ) * eased + this.start;
    
            if ( this.options.step ) {
                this.options.step.call( this.elem, this.now, this );
            }
    
            if ( hooks && hooks.set ) {
                hooks.set( this );
            } else {
                Tween.propHooks._default.set( this );
            }
            return this;
        }
    };
    
    Tween.prototype.init.prototype = Tween.prototype;
    
    Tween.propHooks = {
        _default: {
            get: function( tween ) {
                var result;
    
                // Use a property on the element directly when it is not a DOM element,
                // or when there is no matching style property that exists.
                if ( tween.elem.nodeType !== 1 ||
                    tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
                    return tween.elem[ tween.prop ];
                }
    
                // Passing an empty string as a 3rd parameter to .css will automatically
                // attempt a parseFloat and fallback to a string if the parse fails.
                // Simple values such as "10px" are parsed to Float;
                // complex values such as "rotate(1rad)" are returned as-is.
                result = jQuery.css( tween.elem, tween.prop, "" );
    
                // Empty strings, null, undefined and "auto" are converted to 0.
                return !result || result === "auto" ? 0 : result;
            },
            set: function( tween ) {
    
                // Use step hook for back compat.
                // Use cssHook if its there.
                // Use .style if available and use plain properties where available.
                if ( jQuery.fx.step[ tween.prop ] ) {
                    jQuery.fx.step[ tween.prop ]( tween );
                } else if ( tween.elem.nodeType === 1 &&
                    ( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null ||
                        jQuery.cssHooks[ tween.prop ] ) ) {
                    jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
                } else {
                    tween.elem[ tween.prop ] = tween.now;
                }
            }
        }
    };
    
    // Support: IE <=9 only
    // Panic based approach to setting things on disconnected nodes
    Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
        set: function( tween ) {
            if ( tween.elem.nodeType && tween.elem.parentNode ) {
                tween.elem[ tween.prop ] = tween.now;
            }
        }
    };
    
    jQuery.easing = {
        linear: function( p ) {
            return p;
        },
        swing: function( p ) {
            return 0.5 - Math.cos( p * Math.PI ) / 2;
        },
        _default: "swing"
    };
    
    jQuery.fx = Tween.prototype.init;
    
    // Back compat <1.8 extension point
    jQuery.fx.step = {};
    
    
    
    
    var
        fxNow, timerId,
        rfxtypes = /^(?:toggle|show|hide)$/,
        rrun = /queueHooks$/;
    
    function raf() {
        if ( timerId ) {
            window.requestAnimationFrame( raf );
            jQuery.fx.tick();
        }
    }
    
    // Animations created synchronously will run synchronously
    function createFxNow() {
        window.setTimeout( function() {
            fxNow = undefined;
        } );
        return ( fxNow = jQuery.now() );
    }
    
    // Generate parameters to create a standard animation
    function genFx( type, includeWidth ) {
        var which,
            i = 0,
            attrs = { height: type };
    
        // If we include width, step value is 1 to do all cssExpand values,
        // otherwise step value is 2 to skip over Left and Right
        includeWidth = includeWidth ? 1 : 0;
        for ( ; i < 4; i += 2 - includeWidth ) {
            which = cssExpand[ i ];
            attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
        }
    
        if ( includeWidth ) {
            attrs.opacity = attrs.width = type;
        }
    
        return attrs;
    }
    
    function createTween( value, prop, animation ) {
        var tween,
            collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
            index = 0,
            length = collection.length;
        for ( ; index < length; index++ ) {
            if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {
    
                // We're done with this property
                return tween;
            }
        }
    }
    
    function defaultPrefilter( elem, props, opts ) {
        var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
            isBox = "width" in props || "height" in props,
            anim = this,
            orig = {},
            style = elem.style,
            hidden = elem.nodeType && isHiddenWithinTree( elem ),
            dataShow = dataPriv.get( elem, "fxshow" );
    
        // Queue-skipping animations hijack the fx hooks
        if ( !opts.queue ) {
            hooks = jQuery._queueHooks( elem, "fx" );
            if ( hooks.unqueued == null ) {
                hooks.unqueued = 0;
                oldfire = hooks.empty.fire;
                hooks.empty.fire = function() {
                    if ( !hooks.unqueued ) {
                        oldfire();
                    }
                };
            }
            hooks.unqueued++;
    
            anim.always( function() {
    
                // Ensure the complete handler is called before this completes
                anim.always( function() {
                    hooks.unqueued--;
                    if ( !jQuery.queue( elem, "fx" ).length ) {
                        hooks.empty.fire();
                    }
                } );
            } );
        }
    
        // Detect show/hide animations
        for ( prop in props ) {
            value = props[ prop ];
            if ( rfxtypes.test( value ) ) {
                delete props[ prop ];
                toggle = toggle || value === "toggle";
                if ( value === ( hidden ? "hide" : "show" ) ) {
    
                    // Pretend to be hidden if this is a "show" and
                    // there is still data from a stopped show/hide
                    if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
                        hidden = true;
    
                    // Ignore all other no-op show/hide data
                    } else {
                        continue;
                    }
                }
                orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
            }
        }
    
        // Bail out if this is a no-op like .hide().hide()
        propTween = !jQuery.isEmptyObject( props );
        if ( !propTween && jQuery.isEmptyObject( orig ) ) {
            return;
        }
    
        // Restrict "overflow" and "display" styles during box animations
        if ( isBox && elem.nodeType === 1 ) {
    
            // Support: IE <=9 - 11, Edge 12 - 13
            // Record all 3 overflow attributes because IE does not infer the shorthand
            // from identically-valued overflowX and overflowY
            opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];
    
            // Identify a display type, preferring old show/hide data over the CSS cascade
            restoreDisplay = dataShow && dataShow.display;
            if ( restoreDisplay == null ) {
                restoreDisplay = dataPriv.get( elem, "display" );
            }
            display = jQuery.css( elem, "display" );
            if ( display === "none" ) {
                if ( restoreDisplay ) {
                    display = restoreDisplay;
                } else {
    
                    // Get nonempty value(s) by temporarily forcing visibility
                    showHide( [ elem ], true );
                    restoreDisplay = elem.style.display || restoreDisplay;
                    display = jQuery.css( elem, "display" );
                    showHide( [ elem ] );
                }
            }
    
            // Animate inline elements as inline-block
            if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
                if ( jQuery.css( elem, "float" ) === "none" ) {
    
                    // Restore the original display value at the end of pure show/hide animations
                    if ( !propTween ) {
                        anim.done( function() {
                            style.display = restoreDisplay;
                        } );
                        if ( restoreDisplay == null ) {
                            display = style.display;
                            restoreDisplay = display === "none" ? "" : display;
                        }
                    }
                    style.display = "inline-block";
                }
            }
        }
    
        if ( opts.overflow ) {
            style.overflow = "hidden";
            anim.always( function() {
                style.overflow = opts.overflow[ 0 ];
                style.overflowX = opts.overflow[ 1 ];
                style.overflowY = opts.overflow[ 2 ];
            } );
        }
    
        // Implement show/hide animations
        propTween = false;
        for ( prop in orig ) {
    
            // General show/hide setup for this element animation
            if ( !propTween ) {
                if ( dataShow ) {
                    if ( "hidden" in dataShow ) {
                        hidden = dataShow.hidden;
                    }
                } else {
                    dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
                }
    
                // Store hidden/visible for toggle so `.stop().toggle()` "reverses"
                if ( toggle ) {
                    dataShow.hidden = !hidden;
                }
    
                // Show elements before animating them
                if ( hidden ) {
                    showHide( [ elem ], true );
                }
    
                /* eslint-disable no-loop-func */
    
                anim.done( function() {
    
                /* eslint-enable no-loop-func */
    
                    // The final step of a "hide" animation is actually hiding the element
                    if ( !hidden ) {
                        showHide( [ elem ] );
                    }
                    dataPriv.remove( elem, "fxshow" );
                    for ( prop in orig ) {
                        jQuery.style( elem, prop, orig[ prop ] );
                    }
                } );
            }
    
            // Per-property setup
            propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
            if ( !( prop in dataShow ) ) {
                dataShow[ prop ] = propTween.start;
                if ( hidden ) {
                    propTween.end = propTween.start;
                    propTween.start = 0;
                }
            }
        }
    }
    
    function propFilter( props, specialEasing ) {
        var index, name, easing, value, hooks;
    
        // camelCase, specialEasing and expand cssHook pass
        for ( index in props ) {
            name = jQuery.camelCase( index );
            easing = specialEasing[ name ];
            value = props[ index ];
            if ( jQuery.isArray( value ) ) {
                easing = value[ 1 ];
                value = props[ index ] = value[ 0 ];
            }
    
            if ( index !== name ) {
                props[ name ] = value;
                delete props[ index ];
            }
    
            hooks = jQuery.cssHooks[ name ];
            if ( hooks && "expand" in hooks ) {
                value = hooks.expand( value );
                delete props[ name ];
    
                // Not quite $.extend, this won't overwrite existing keys.
                // Reusing 'index' because we have the correct "name"
                for ( index in value ) {
                    if ( !( index in props ) ) {
                        props[ index ] = value[ index ];
                        specialEasing[ index ] = easing;
                    }
                }
            } else {
                specialEasing[ name ] = easing;
            }
        }
    }
    
    function Animation( elem, properties, options ) {
        var result,
            stopped,
            index = 0,
            length = Animation.prefilters.length,
            deferred = jQuery.Deferred().always( function() {
    
                // Don't match elem in the :animated selector
                delete tick.elem;
            } ),
            tick = function() {
                if ( stopped ) {
                    return false;
                }
                var currentTime = fxNow || createFxNow(),
                    remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),
    
                    // Support: Android 2.3 only
                    // Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
                    temp = remaining / animation.duration || 0,
                    percent = 1 - temp,
                    index = 0,
                    length = animation.tweens.length;
    
                for ( ; index < length; index++ ) {
                    animation.tweens[ index ].run( percent );
                }
    
                deferred.notifyWith( elem, [ animation, percent, remaining ] );
    
                if ( percent < 1 && length ) {
                    return remaining;
                } else {
                    deferred.resolveWith( elem, [ animation ] );
                    return false;
                }
            },
            animation = deferred.promise( {
                elem: elem,
                props: jQuery.extend( {}, properties ),
                opts: jQuery.extend( true, {
                    specialEasing: {},
                    easing: jQuery.easing._default
                }, options ),
                originalProperties: properties,
                originalOptions: options,
                startTime: fxNow || createFxNow(),
                duration: options.duration,
                tweens: [],
                createTween: function( prop, end ) {
                    var tween = jQuery.Tween( elem, animation.opts, prop, end,
                            animation.opts.specialEasing[ prop ] || animation.opts.easing );
                    animation.tweens.push( tween );
                    return tween;
                },
                stop: function( gotoEnd ) {
                    var index = 0,
    
                        // If we are going to the end, we want to run all the tweens
                        // otherwise we skip this part
                        length = gotoEnd ? animation.tweens.length : 0;
                    if ( stopped ) {
                        return this;
                    }
                    stopped = true;
                    for ( ; index < length; index++ ) {
                        animation.tweens[ index ].run( 1 );
                    }
    
                    // Resolve when we played the last frame; otherwise, reject
                    if ( gotoEnd ) {
                        deferred.notifyWith( elem, [ animation, 1, 0 ] );
                        deferred.resolveWith( elem, [ animation, gotoEnd ] );
                    } else {
                        deferred.rejectWith( elem, [ animation, gotoEnd ] );
                    }
                    return this;
                }
            } ),
            props = animation.props;
    
        propFilter( props, animation.opts.specialEasing );
    
        for ( ; index < length; index++ ) {
            result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
            if ( result ) {
                if ( jQuery.isFunction( result.stop ) ) {
                    jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
                        jQuery.proxy( result.stop, result );
                }
                return result;
            }
        }
    
        jQuery.map( props, createTween, animation );
    
        if ( jQuery.isFunction( animation.opts.start ) ) {
            animation.opts.start.call( elem, animation );
        }
    
        jQuery.fx.timer(
            jQuery.extend( tick, {
                elem: elem,
                anim: animation,
                queue: animation.opts.queue
            } )
        );
    
        // attach callbacks from options
        return animation.progress( animation.opts.progress )
            .done( animation.opts.done, animation.opts.complete )
            .fail( animation.opts.fail )
            .always( animation.opts.always );
    }
    
    jQuery.Animation = jQuery.extend( Animation, {
    
        tweeners: {
            "*": [ function( prop, value ) {
                var tween = this.createTween( prop, value );
                adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
                return tween;
            } ]
        },
    
        tweener: function( props, callback ) {
            if ( jQuery.isFunction( props ) ) {
                callback = props;
                props = [ "*" ];
            } else {
                props = props.match( rnothtmlwhite );
            }
    
            var prop,
                index = 0,
                length = props.length;
    
            for ( ; index < length; index++ ) {
                prop = props[ index ];
                Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
                Animation.tweeners[ prop ].unshift( callback );
            }
        },
    
        prefilters: [ defaultPrefilter ],
    
        prefilter: function( callback, prepend ) {
            if ( prepend ) {
                Animation.prefilters.unshift( callback );
            } else {
                Animation.prefilters.push( callback );
            }
        }
    } );
    
    jQuery.speed = function( speed, easing, fn ) {
        var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
            complete: fn || !fn && easing ||
                jQuery.isFunction( speed ) && speed,
            duration: speed,
            easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
        };
    
        // Go to the end state if fx are off or if document is hidden
        if ( jQuery.fx.off || document.hidden ) {
            opt.duration = 0;
    
        } else {
            if ( typeof opt.duration !== "number" ) {
                if ( opt.duration in jQuery.fx.speeds ) {
                    opt.duration = jQuery.fx.speeds[ opt.duration ];
    
                } else {
                    opt.duration = jQuery.fx.speeds._default;
                }
            }
        }
    
        // Normalize opt.queue - true/undefined/null -> "fx"
        if ( opt.queue == null || opt.queue === true ) {
            opt.queue = "fx";
        }
    
        // Queueing
        opt.old = opt.complete;
    
        opt.complete = function() {
            if ( jQuery.isFunction( opt.old ) ) {
                opt.old.call( this );
            }
    
            if ( opt.queue ) {
                jQuery.dequeue( this, opt.queue );
            }
        };
    
        return opt;
    };
    
    jQuery.fn.extend( {
        fadeTo: function( speed, to, easing, callback ) {
    
            // Show any hidden elements after setting opacity to 0
            return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()
    
                // Animate to the value specified
                .end().animate( { opacity: to }, speed, easing, callback );
        },
        animate: function( prop, speed, easing, callback ) {
            var empty = jQuery.isEmptyObject( prop ),
                optall = jQuery.speed( speed, easing, callback ),
                doAnimation = function() {
    
                    // Operate on a copy of prop so per-property easing won't be lost
                    var anim = Animation( this, jQuery.extend( {}, prop ), optall );
    
                    // Empty animations, or finishing resolves immediately
                    if ( empty || dataPriv.get( this, "finish" ) ) {
                        anim.stop( true );
                    }
                };
                doAnimation.finish = doAnimation;
    
            return empty || optall.queue === false ?
                this.each( doAnimation ) :
                this.queue( optall.queue, doAnimation );
        },
        stop: function( type, clearQueue, gotoEnd ) {
            var stopQueue = function( hooks ) {
                var stop = hooks.stop;
                delete hooks.stop;
                stop( gotoEnd );
            };
    
            if ( typeof type !== "string" ) {
                gotoEnd = clearQueue;
                clearQueue = type;
                type = undefined;
            }
            if ( clearQueue && type !== false ) {
                this.queue( type || "fx", [] );
            }
    
            return this.each( function() {
                var dequeue = true,
                    index = type != null && type + "queueHooks",
                    timers = jQuery.timers,
                    data = dataPriv.get( this );
    
                if ( index ) {
                    if ( data[ index ] && data[ index ].stop ) {
                        stopQueue( data[ index ] );
                    }
                } else {
                    for ( index in data ) {
                        if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
                            stopQueue( data[ index ] );
                        }
                    }
                }
    
                for ( index = timers.length; index--; ) {
                    if ( timers[ index ].elem === this &&
                        ( type == null || timers[ index ].queue === type ) ) {
    
                        timers[ index ].anim.stop( gotoEnd );
                        dequeue = false;
                        timers.splice( index, 1 );
                    }
                }
    
                // Start the next in the queue if the last step wasn't forced.
                // Timers currently will call their complete callbacks, which
                // will dequeue but only if they were gotoEnd.
                if ( dequeue || !gotoEnd ) {
                    jQuery.dequeue( this, type );
                }
            } );
        },
        finish: function( type ) {
            if ( type !== false ) {
                type = type || "fx";
            }
            return this.each( function() {
                var index,
                    data = dataPriv.get( this ),
                    queue = data[ type + "queue" ],
                    hooks = data[ type + "queueHooks" ],
                    timers = jQuery.timers,
                    length = queue ? queue.length : 0;
    
                // Enable finishing flag on private data
                data.finish = true;
    
                // Empty the queue first
                jQuery.queue( this, type, [] );
    
                if ( hooks && hooks.stop ) {
                    hooks.stop.call( this, true );
                }
    
                // Look for any active animations, and finish them
                for ( index = timers.length; index--; ) {
                    if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
                        timers[ index ].anim.stop( true );
                        timers.splice( index, 1 );
                    }
                }
    
                // Look for any animations in the old queue and finish them
                for ( index = 0; index < length; index++ ) {
                    if ( queue[ index ] && queue[ index ].finish ) {
                        queue[ index ].finish.call( this );
                    }
                }
    
                // Turn off finishing flag
                delete data.finish;
            } );
        }
    } );
    
    jQuery.each( [ "toggle", "show", "hide" ], function( i, name ) {
        var cssFn = jQuery.fn[ name ];
        jQuery.fn[ name ] = function( speed, easing, callback ) {
            return speed == null || typeof speed === "boolean" ?
                cssFn.apply( this, arguments ) :
                this.animate( genFx( name, true ), speed, easing, callback );
        };
    } );
    
    // Generate shortcuts for custom animations
    jQuery.each( {
        slideDown: genFx( "show" ),
        slideUp: genFx( "hide" ),
        slideToggle: genFx( "toggle" ),
        fadeIn: { opacity: "show" },
        fadeOut: { opacity: "hide" },
        fadeToggle: { opacity: "toggle" }
    }, function( name, props ) {
        jQuery.fn[ name ] = function( speed, easing, callback ) {
            return this.animate( props, speed, easing, callback );
        };
    } );
    
    jQuery.timers = [];
    jQuery.fx.tick = function() {
        var timer,
            i = 0,
            timers = jQuery.timers;
    
        fxNow = jQuery.now();
    
        for ( ; i < timers.length; i++ ) {
            timer = timers[ i ];
    
            // Checks the timer has not already been removed
            if ( !timer() && timers[ i ] === timer ) {
                timers.splice( i--, 1 );
            }
        }
    
        if ( !timers.length ) {
            jQuery.fx.stop();
        }
        fxNow = undefined;
    };
    
    jQuery.fx.timer = function( timer ) {
        jQuery.timers.push( timer );
        if ( timer() ) {
            jQuery.fx.start();
        } else {
            jQuery.timers.pop();
        }
    };
    
    jQuery.fx.interval = 13;
    jQuery.fx.start = function() {
        if ( !timerId ) {
            timerId = window.requestAnimationFrame ?
                window.requestAnimationFrame( raf ) :
                window.setInterval( jQuery.fx.tick, jQuery.fx.interval );
        }
    };
    
    jQuery.fx.stop = function() {
        if ( window.cancelAnimationFrame ) {
            window.cancelAnimationFrame( timerId );
        } else {
            window.clearInterval( timerId );
        }
    
        timerId = null;
    };
    
    jQuery.fx.speeds = {
        slow: 600,
        fast: 200,
    
        // Default speed
        _default: 400
    };
    
    
    // Based off of the plugin by Clint Helfers, with permission.
    // https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
    jQuery.fn.delay = function( time, type ) {
        time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
        type = type || "fx";
    
        return this.queue( type, function( next, hooks ) {
            var timeout = window.setTimeout( next, time );
            hooks.stop = function() {
                window.clearTimeout( timeout );
            };
        } );
    };
    
    
    ( function() {
        var input = document.createElement( "input" ),
            select = document.createElement( "select" ),
            opt = select.appendChild( document.createElement( "option" ) );
    
        input.type = "checkbox";
    
        // Support: Android <=4.3 only
        // Default value for a checkbox should be "on"
        support.checkOn = input.value !== "";
    
        // Support: IE <=11 only
        // Must access selectedIndex to make default options select
        support.optSelected = opt.selected;
    
        // Support: IE <=11 only
        // An input loses its value after becoming a radio
        input = document.createElement( "input" );
        input.value = "t";
        input.type = "radio";
        support.radioValue = input.value === "t";
    } )();
    
    
    var boolHook,
        attrHandle = jQuery.expr.attrHandle;
    
    jQuery.fn.extend( {
        attr: function( name, value ) {
            return access( this, jQuery.attr, name, value, arguments.length > 1 );
        },
    
        removeAttr: function( name ) {
            return this.each( function() {
                jQuery.removeAttr( this, name );
            } );
        }
    } );
    
    jQuery.extend( {
        attr: function( elem, name, value ) {
            var ret, hooks,
                nType = elem.nodeType;
    
            // Don't get/set attributes on text, comment and attribute nodes
            if ( nType === 3 || nType === 8 || nType === 2 ) {
                return;
            }
    
            // Fallback to prop when attributes are not supported
            if ( typeof elem.getAttribute === "undefined" ) {
                return jQuery.prop( elem, name, value );
            }
    
            // Attribute hooks are determined by the lowercase version
            // Grab necessary hook if one is defined
            if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
                hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
                    ( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
            }
    
            if ( value !== undefined ) {
                if ( value === null ) {
                    jQuery.removeAttr( elem, name );
                    return;
                }
    
                if ( hooks && "set" in hooks &&
                    ( ret = hooks.set( elem, value, name ) ) !== undefined ) {
                    return ret;
                }
    
                elem.setAttribute( name, value + "" );
                return value;
            }
    
            if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
                return ret;
            }
    
            ret = jQuery.find.attr( elem, name );
    
            // Non-existent attributes return null, we normalize to undefined
            return ret == null ? undefined : ret;
        },
    
        attrHooks: {
            type: {
                set: function( elem, value ) {
                    if ( !support.radioValue && value === "radio" &&
                        jQuery.nodeName( elem, "input" ) ) {
                        var val = elem.value;
                        elem.setAttribute( "type", value );
                        if ( val ) {
                            elem.value = val;
                        }
                        return value;
                    }
                }
            }
        },
    
        removeAttr: function( elem, value ) {
            var name,
                i = 0,
    
                // Attribute names can contain non-HTML whitespace characters
                // https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
                attrNames = value && value.match( rnothtmlwhite );
    
            if ( attrNames && elem.nodeType === 1 ) {
                while ( ( name = attrNames[ i++ ] ) ) {
                    elem.removeAttribute( name );
                }
            }
        }
    } );
    
    // Hooks for boolean attributes
    boolHook = {
        set: function( elem, value, name ) {
            if ( value === false ) {
    
                // Remove boolean attributes when set to false
                jQuery.removeAttr( elem, name );
            } else {
                elem.setAttribute( name, name );
            }
            return name;
        }
    };
    
    jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
        var getter = attrHandle[ name ] || jQuery.find.attr;
    
        attrHandle[ name ] = function( elem, name, isXML ) {
            var ret, handle,
                lowercaseName = name.toLowerCase();
    
            if ( !isXML ) {
    
                // Avoid an infinite loop by temporarily removing this function from the getter
                handle = attrHandle[ lowercaseName ];
                attrHandle[ lowercaseName ] = ret;
                ret = getter( elem, name, isXML ) != null ?
                    lowercaseName :
                    null;
                attrHandle[ lowercaseName ] = handle;
            }
            return ret;
        };
    } );
    
    
    
    
    var rfocusable = /^(?:input|select|textarea|button)$/i,
        rclickable = /^(?:a|area)$/i;
    
    jQuery.fn.extend( {
        prop: function( name, value ) {
            return access( this, jQuery.prop, name, value, arguments.length > 1 );
        },
    
        removeProp: function( name ) {
            return this.each( function() {
                delete this[ jQuery.propFix[ name ] || name ];
            } );
        }
    } );
    
    jQuery.extend( {
        prop: function( elem, name, value ) {
            var ret, hooks,
                nType = elem.nodeType;
    
            // Don't get/set properties on text, comment and attribute nodes
            if ( nType === 3 || nType === 8 || nType === 2 ) {
                return;
            }
    
            if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
    
                // Fix name and attach hooks
                name = jQuery.propFix[ name ] || name;
                hooks = jQuery.propHooks[ name ];
            }
    
            if ( value !== undefined ) {
                if ( hooks && "set" in hooks &&
                    ( ret = hooks.set( elem, value, name ) ) !== undefined ) {
                    return ret;
                }
    
                return ( elem[ name ] = value );
            }
    
            if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
                return ret;
            }
    
            return elem[ name ];
        },
    
        propHooks: {
            tabIndex: {
                get: function( elem ) {
    
                    // Support: IE <=9 - 11 only
                    // elem.tabIndex doesn't always return the
                    // correct value when it hasn't been explicitly set
                    // https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
                    // Use proper attribute retrieval(#12072)
                    var tabindex = jQuery.find.attr( elem, "tabindex" );
    
                    if ( tabindex ) {
                        return parseInt( tabindex, 10 );
                    }
    
                    if (
                        rfocusable.test( elem.nodeName ) ||
                        rclickable.test( elem.nodeName ) &&
                        elem.href
                    ) {
                        return 0;
                    }
    
                    return -1;
                }
            }
        },
    
        propFix: {
            "for": "htmlFor",
            "class": "className"
        }
    } );
    
    // Support: IE <=11 only
    // Accessing the selectedIndex property
    // forces the browser to respect setting selected
    // on the option
    // The getter ensures a default option is selected
    // when in an optgroup
    // eslint rule "no-unused-expressions" is disabled for this code
    // since it considers such accessions noop
    if ( !support.optSelected ) {
        jQuery.propHooks.selected = {
            get: function( elem ) {
    
                /* eslint no-unused-expressions: "off" */
    
                var parent = elem.parentNode;
                if ( parent && parent.parentNode ) {
                    parent.parentNode.selectedIndex;
                }
                return null;
            },
            set: function( elem ) {
    
                /* eslint no-unused-expressions: "off" */
    
                var parent = elem.parentNode;
                if ( parent ) {
                    parent.selectedIndex;
    
                    if ( parent.parentNode ) {
                        parent.parentNode.selectedIndex;
                    }
                }
            }
        };
    }
    
    jQuery.each( [
        "tabIndex",
        "readOnly",
        "maxLength",
        "cellSpacing",
        "cellPadding",
        "rowSpan",
        "colSpan",
        "useMap",
        "frameBorder",
        "contentEditable"
    ], function() {
        jQuery.propFix[ this.toLowerCase() ] = this;
    } );
    
    
    
    
        // Strip and collapse whitespace according to HTML spec
        // https://html.spec.whatwg.org/multipage/infrastructure.html#strip-and-collapse-whitespace
        function stripAndCollapse( value ) {
            var tokens = value.match( rnothtmlwhite ) || [];
            return tokens.join( " " );
        }
    
    
    function getClass( elem ) {
        return elem.getAttribute && elem.getAttribute( "class" ) || "";
    }
    
    jQuery.fn.extend( {
        addClass: function( value ) {
            var classes, elem, cur, curValue, clazz, j, finalValue,
                i = 0;
    
            if ( jQuery.isFunction( value ) ) {
                return this.each( function( j ) {
                    jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
                } );
            }
    
            if ( typeof value === "string" && value ) {
                classes = value.match( rnothtmlwhite ) || [];
    
                while ( ( elem = this[ i++ ] ) ) {
                    curValue = getClass( elem );
                    cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );
    
                    if ( cur ) {
                        j = 0;
                        while ( ( clazz = classes[ j++ ] ) ) {
                            if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
                                cur += clazz + " ";
                            }
                        }
    
                        // Only assign if different to avoid unneeded rendering.
                        finalValue = stripAndCollapse( cur );
                        if ( curValue !== finalValue ) {
                            elem.setAttribute( "class", finalValue );
                        }
                    }
                }
            }
    
            return this;
        },
    
        removeClass: function( value ) {
            var classes, elem, cur, curValue, clazz, j, finalValue,
                i = 0;
    
            if ( jQuery.isFunction( value ) ) {
                return this.each( function( j ) {
                    jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
                } );
            }
    
            if ( !arguments.length ) {
                return this.attr( "class", "" );
            }
    
            if ( typeof value === "string" && value ) {
                classes = value.match( rnothtmlwhite ) || [];
    
                while ( ( elem = this[ i++ ] ) ) {
                    curValue = getClass( elem );
    
                    // This expression is here for better compressibility (see addClass)
                    cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );
    
                    if ( cur ) {
                        j = 0;
                        while ( ( clazz = classes[ j++ ] ) ) {
    
                            // Remove *all* instances
                            while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
                                cur = cur.replace( " " + clazz + " ", " " );
                            }
                        }
    
                        // Only assign if different to avoid unneeded rendering.
                        finalValue = stripAndCollapse( cur );
                        if ( curValue !== finalValue ) {
                            elem.setAttribute( "class", finalValue );
                        }
                    }
                }
            }
    
            return this;
        },
    
        toggleClass: function( value, stateVal ) {
            var type = typeof value;
    
            if ( typeof stateVal === "boolean" && type === "string" ) {
                return stateVal ? this.addClass( value ) : this.removeClass( value );
            }
    
            if ( jQuery.isFunction( value ) ) {
                return this.each( function( i ) {
                    jQuery( this ).toggleClass(
                        value.call( this, i, getClass( this ), stateVal ),
                        stateVal
                    );
                } );
            }
    
            return this.each( function() {
                var className, i, self, classNames;
    
                if ( type === "string" ) {
    
                    // Toggle individual class names
                    i = 0;
                    self = jQuery( this );
                    classNames = value.match( rnothtmlwhite ) || [];
    
                    while ( ( className = classNames[ i++ ] ) ) {
    
                        // Check each className given, space separated list
                        if ( self.hasClass( className ) ) {
                            self.removeClass( className );
                        } else {
                            self.addClass( className );
                        }
                    }
    
                // Toggle whole class name
                } else if ( value === undefined || type === "boolean" ) {
                    className = getClass( this );
                    if ( className ) {
    
                        // Store className if set
                        dataPriv.set( this, "__className__", className );
                    }
    
                    // If the element has a class name or if we're passed `false`,
                    // then remove the whole classname (if there was one, the above saved it).
                    // Otherwise bring back whatever was previously saved (if anything),
                    // falling back to the empty string if nothing was stored.
                    if ( this.setAttribute ) {
                        this.setAttribute( "class",
                            className || value === false ?
                            "" :
                            dataPriv.get( this, "__className__" ) || ""
                        );
                    }
                }
            } );
        },
    
        hasClass: function( selector ) {
            var className, elem,
                i = 0;
    
            className = " " + selector + " ";
            while ( ( elem = this[ i++ ] ) ) {
                if ( elem.nodeType === 1 &&
                    ( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
                        return true;
                }
            }
    
            return false;
        }
    } );
    
    
    
    
    var rreturn = /\r/g;
    
    jQuery.fn.extend( {
        val: function( value ) {
            var hooks, ret, isFunction,
                elem = this[ 0 ];
    
            if ( !arguments.length ) {
                if ( elem ) {
                    hooks = jQuery.valHooks[ elem.type ] ||
                        jQuery.valHooks[ elem.nodeName.toLowerCase() ];
    
                    if ( hooks &&
                        "get" in hooks &&
                        ( ret = hooks.get( elem, "value" ) ) !== undefined
                    ) {
                        return ret;
                    }
    
                    ret = elem.value;
    
                    // Handle most common string cases
                    if ( typeof ret === "string" ) {
                        return ret.replace( rreturn, "" );
                    }
    
                    // Handle cases where value is null/undef or number
                    return ret == null ? "" : ret;
                }
    
                return;
            }
    
            isFunction = jQuery.isFunction( value );
    
            return this.each( function( i ) {
                var val;
    
                if ( this.nodeType !== 1 ) {
                    return;
                }
    
                if ( isFunction ) {
                    val = value.call( this, i, jQuery( this ).val() );
                } else {
                    val = value;
                }
    
                // Treat null/undefined as ""; convert numbers to string
                if ( val == null ) {
                    val = "";
    
                } else if ( typeof val === "number" ) {
                    val += "";
    
                } else if ( jQuery.isArray( val ) ) {
                    val = jQuery.map( val, function( value ) {
                        return value == null ? "" : value + "";
                    } );
                }
    
                hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];
    
                // If set returns undefined, fall back to normal setting
                if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
                    this.value = val;
                }
            } );
        }
    } );
    
    jQuery.extend( {
        valHooks: {
            option: {
                get: function( elem ) {
    
                    var val = jQuery.find.attr( elem, "value" );
                    return val != null ?
                        val :
    
                        // Support: IE <=10 - 11 only
                        // option.text throws exceptions (#14686, #14858)
                        // Strip and collapse whitespace
                        // https://html.spec.whatwg.org/#strip-and-collapse-whitespace
                        stripAndCollapse( jQuery.text( elem ) );
                }
            },
            select: {
                get: function( elem ) {
                    var value, option, i,
                        options = elem.options,
                        index = elem.selectedIndex,
                        one = elem.type === "select-one",
                        values = one ? null : [],
                        max = one ? index + 1 : options.length;
    
                    if ( index < 0 ) {
                        i = max;
    
                    } else {
                        i = one ? index : 0;
                    }
    
                    // Loop through all the selected options
                    for ( ; i < max; i++ ) {
                        option = options[ i ];
    
                        // Support: IE <=9 only
                        // IE8-9 doesn't update selected after form reset (#2551)
                        if ( ( option.selected || i === index ) &&
    
                                // Don't return options that are disabled or in a disabled optgroup
                                !option.disabled &&
                                ( !option.parentNode.disabled ||
                                    !jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {
    
                            // Get the specific value for the option
                            value = jQuery( option ).val();
    
                            // We don't need an array for one selects
                            if ( one ) {
                                return value;
                            }
    
                            // Multi-Selects return an array
                            values.push( value );
                        }
                    }
    
                    return values;
                },
    
                set: function( elem, value ) {
                    var optionSet, option,
                        options = elem.options,
                        values = jQuery.makeArray( value ),
                        i = options.length;
    
                    while ( i-- ) {
                        option = options[ i ];
    
                        /* eslint-disable no-cond-assign */
    
                        if ( option.selected =
                            jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
                        ) {
                            optionSet = true;
                        }
    
                        /* eslint-enable no-cond-assign */
                    }
    
                    // Force browsers to behave consistently when non-matching value is set
                    if ( !optionSet ) {
                        elem.selectedIndex = -1;
                    }
                    return values;
                }
            }
        }
    } );
    
    // Radios and checkboxes getter/setter
    jQuery.each( [ "radio", "checkbox" ], function() {
        jQuery.valHooks[ this ] = {
            set: function( elem, value ) {
                if ( jQuery.isArray( value ) ) {
                    return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
                }
            }
        };
        if ( !support.checkOn ) {
            jQuery.valHooks[ this ].get = function( elem ) {
                return elem.getAttribute( "value" ) === null ? "on" : elem.value;
            };
        }
    } );
    
    
    
    
    // Return jQuery for attributes-only inclusion
    
    
    var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/;
    
    jQuery.extend( jQuery.event, {
    
        trigger: function( event, data, elem, onlyHandlers ) {
    
            var i, cur, tmp, bubbleType, ontype, handle, special,
                eventPath = [ elem || document ],
                type = hasOwn.call( event, "type" ) ? event.type : event,
                namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];
    
            cur = tmp = elem = elem || document;
    
            // Don't do events on text and comment nodes
            if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
                return;
            }
    
            // focus/blur morphs to focusin/out; ensure we're not firing them right now
            if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
                return;
            }
    
            if ( type.indexOf( "." ) > -1 ) {
    
                // Namespaced trigger; create a regexp to match event type in handle()
                namespaces = type.split( "." );
                type = namespaces.shift();
                namespaces.sort();
            }
            ontype = type.indexOf( ":" ) < 0 && "on" + type;
    
            // Caller can pass in a jQuery.Event object, Object, or just an event type string
            event = event[ jQuery.expando ] ?
                event :
                new jQuery.Event( type, typeof event === "object" && event );
    
            // Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
            event.isTrigger = onlyHandlers ? 2 : 3;
            event.namespace = namespaces.join( "." );
            event.rnamespace = event.namespace ?
                new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
                null;
    
            // Clean up the event in case it is being reused
            event.result = undefined;
            if ( !event.target ) {
                event.target = elem;
            }
    
            // Clone any incoming data and prepend the event, creating the handler arg list
            data = data == null ?
                [ event ] :
                jQuery.makeArray( data, [ event ] );
    
            // Allow special events to draw outside the lines
            special = jQuery.event.special[ type ] || {};
            if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
                return;
            }
    
            // Determine event propagation path in advance, per W3C events spec (#9951)
            // Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
            if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {
    
                bubbleType = special.delegateType || type;
                if ( !rfocusMorph.test( bubbleType + type ) ) {
                    cur = cur.parentNode;
                }
                for ( ; cur; cur = cur.parentNode ) {
                    eventPath.push( cur );
                    tmp = cur;
                }
    
                // Only add window if we got to document (e.g., not plain obj or detached DOM)
                if ( tmp === ( elem.ownerDocument || document ) ) {
                    eventPath.push( tmp.defaultView || tmp.parentWindow || window );
                }
            }
    
            // Fire handlers on the event path
            i = 0;
            while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
    
                event.type = i > 1 ?
                    bubbleType :
                    special.bindType || type;
    
                // jQuery handler
                handle = ( dataPriv.get( cur, "events" ) || {} )[ event.type ] &&
                    dataPriv.get( cur, "handle" );
                if ( handle ) {
                    handle.apply( cur, data );
                }
    
                // Native handler
                handle = ontype && cur[ ontype ];
                if ( handle && handle.apply && acceptData( cur ) ) {
                    event.result = handle.apply( cur, data );
                    if ( event.result === false ) {
                        event.preventDefault();
                    }
                }
            }
            event.type = type;
    
            // If nobody prevented the default action, do it now
            if ( !onlyHandlers && !event.isDefaultPrevented() ) {
    
                if ( ( !special._default ||
                    special._default.apply( eventPath.pop(), data ) === false ) &&
                    acceptData( elem ) ) {
    
                    // Call a native DOM method on the target with the same name as the event.
                    // Don't do default actions on window, that's where global variables be (#6170)
                    if ( ontype && jQuery.isFunction( elem[ type ] ) && !jQuery.isWindow( elem ) ) {
    
                        // Don't re-trigger an onFOO event when we call its FOO() method
                        tmp = elem[ ontype ];
    
                        if ( tmp ) {
                            elem[ ontype ] = null;
                        }
    
                        // Prevent re-triggering of the same event, since we already bubbled it above
                        jQuery.event.triggered = type;
                        elem[ type ]();
                        jQuery.event.triggered = undefined;
    
                        if ( tmp ) {
                            elem[ ontype ] = tmp;
                        }
                    }
                }
            }
    
            return event.result;
        },
    
        // Piggyback on a donor event to simulate a different one
        // Used only for `focus(in | out)` events
        simulate: function( type, elem, event ) {
            var e = jQuery.extend(
                new jQuery.Event(),
                event,
                {
                    type: type,
                    isSimulated: true
                }
            );
    
            jQuery.event.trigger( e, null, elem );
        }
    
    } );
    
    jQuery.fn.extend( {
    
        trigger: function( type, data ) {
            return this.each( function() {
                jQuery.event.trigger( type, data, this );
            } );
        },
        triggerHandler: function( type, data ) {
            var elem = this[ 0 ];
            if ( elem ) {
                return jQuery.event.trigger( type, data, elem, true );
            }
        }
    } );
    
    
    jQuery.each( ( "blur focus focusin focusout resize scroll click dblclick " +
        "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
        "change select submit keydown keypress keyup contextmenu" ).split( " " ),
        function( i, name ) {
    
        // Handle event binding
        jQuery.fn[ name ] = function( data, fn ) {
            return arguments.length > 0 ?
                this.on( name, null, data, fn ) :
                this.trigger( name );
        };
    } );
    
    jQuery.fn.extend( {
        hover: function( fnOver, fnOut ) {
            return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
        }
    } );
    
    
    
    
    support.focusin = "onfocusin" in window;
    
    
    // Support: Firefox <=44
    // Firefox doesn't have focus(in | out) events
    // Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
    //
    // Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
    // focus(in | out) events fire after focus & blur events,
    // which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
    // Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
    if ( !support.focusin ) {
        jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {
    
            // Attach a single capturing handler on the document while someone wants focusin/focusout
            var handler = function( event ) {
                jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
            };
    
            jQuery.event.special[ fix ] = {
                setup: function() {
                    var doc = this.ownerDocument || this,
                        attaches = dataPriv.access( doc, fix );
    
                    if ( !attaches ) {
                        doc.addEventListener( orig, handler, true );
                    }
                    dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
                },
                teardown: function() {
                    var doc = this.ownerDocument || this,
                        attaches = dataPriv.access( doc, fix ) - 1;
    
                    if ( !attaches ) {
                        doc.removeEventListener( orig, handler, true );
                        dataPriv.remove( doc, fix );
    
                    } else {
                        dataPriv.access( doc, fix, attaches );
                    }
                }
            };
        } );
    }
    var location = window.location;
    
    var nonce = jQuery.now();
    
    var rquery = ( /\?/ );
    
    
    
    // Cross-browser xml parsing
    jQuery.parseXML = function( data ) {
        var xml;
        if ( !data || typeof data !== "string" ) {
            return null;
        }
    
        // Support: IE 9 - 11 only
        // IE throws on parseFromString with invalid input.
        try {
            xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
        } catch ( e ) {
            xml = undefined;
        }
    
        if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
            jQuery.error( "Invalid XML: " + data );
        }
        return xml;
    };
    
    
    var
        rbracket = /\[\]$/,
        rCRLF = /\r?\n/g,
        rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
        rsubmittable = /^(?:input|select|textarea|keygen)/i;
    
    function buildParams( prefix, obj, traditional, add ) {
        var name;
    
        if ( jQuery.isArray( obj ) ) {
    
            // Serialize array item.
            jQuery.each( obj, function( i, v ) {
                if ( traditional || rbracket.test( prefix ) ) {
    
                    // Treat each array item as a scalar.
                    add( prefix, v );
    
                } else {
    
                    // Item is non-scalar (array or object), encode its numeric index.
                    buildParams(
                        prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
                        v,
                        traditional,
                        add
                    );
                }
            } );
    
        } else if ( !traditional && jQuery.type( obj ) === "object" ) {
    
            // Serialize object item.
            for ( name in obj ) {
                buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
            }
    
        } else {
    
            // Serialize scalar item.
            add( prefix, obj );
        }
    }
    
    // Serialize an array of form elements or a set of
    // key/values into a query string
    jQuery.param = function( a, traditional ) {
        var prefix,
            s = [],
            add = function( key, valueOrFunction ) {
    
                // If value is a function, invoke it and use its return value
                var value = jQuery.isFunction( valueOrFunction ) ?
                    valueOrFunction() :
                    valueOrFunction;
    
                s[ s.length ] = encodeURIComponent( key ) + "=" +
                    encodeURIComponent( value == null ? "" : value );
            };
    
        // If an array was passed in, assume that it is an array of form elements.
        if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
    
            // Serialize the form elements
            jQuery.each( a, function() {
                add( this.name, this.value );
            } );
    
        } else {
    
            // If traditional, encode the "old" way (the way 1.3.2 or older
            // did it), otherwise encode params recursively.
            for ( prefix in a ) {
                buildParams( prefix, a[ prefix ], traditional, add );
            }
        }
    
        // Return the resulting serialization
        return s.join( "&" );
    };
    
    jQuery.fn.extend( {
        serialize: function() {
            return jQuery.param( this.serializeArray() );
        },
        serializeArray: function() {
            return this.map( function() {
    
                // Can add propHook for "elements" to filter or add form elements
                var elements = jQuery.prop( this, "elements" );
                return elements ? jQuery.makeArray( elements ) : this;
            } )
            .filter( function() {
                var type = this.type;
    
                // Use .is( ":disabled" ) so that fieldset[disabled] works
                return this.name && !jQuery( this ).is( ":disabled" ) &&
                    rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
                    ( this.checked || !rcheckableType.test( type ) );
            } )
            .map( function( i, elem ) {
                var val = jQuery( this ).val();
    
                if ( val == null ) {
                    return null;
                }
    
                if ( jQuery.isArray( val ) ) {
                    return jQuery.map( val, function( val ) {
                        return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
                    } );
                }
    
                return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
            } ).get();
        }
    } );
    
    
    var
        r20 = /%20/g,
        rhash = /#.*$/,
        rantiCache = /([?&])_=[^&]*/,
        rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,
    
        // #7653, #8125, #8152: local protocol detection
        rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
        rnoContent = /^(?:GET|HEAD)$/,
        rprotocol = /^\/\//,
    
        /* Prefilters
         * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
         * 2) These are called:
         *    - BEFORE asking for a transport
         *    - AFTER param serialization (s.data is a string if s.processData is true)
         * 3) key is the dataType
         * 4) the catchall symbol "*" can be used
         * 5) execution will start with transport dataType and THEN continue down to "*" if needed
         */
        prefilters = {},
    
        /* Transports bindings
         * 1) key is the dataType
         * 2) the catchall symbol "*" can be used
         * 3) selection will start with transport dataType and THEN go to "*" if needed
         */
        transports = {},
    
        // Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
        allTypes = "*/".concat( "*" ),
    
        // Anchor tag for parsing the document origin
        originAnchor = document.createElement( "a" );
        originAnchor.href = location.href;
    
    // Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
    function addToPrefiltersOrTransports( structure ) {
    
        // dataTypeExpression is optional and defaults to "*"
        return function( dataTypeExpression, func ) {
    
            if ( typeof dataTypeExpression !== "string" ) {
                func = dataTypeExpression;
                dataTypeExpression = "*";
            }
    
            var dataType,
                i = 0,
                dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];
    
            if ( jQuery.isFunction( func ) ) {
    
                // For each dataType in the dataTypeExpression
                while ( ( dataType = dataTypes[ i++ ] ) ) {
    
                    // Prepend if requested
                    if ( dataType[ 0 ] === "+" ) {
                        dataType = dataType.slice( 1 ) || "*";
                        ( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );
    
                    // Otherwise append
                    } else {
                        ( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
                    }
                }
            }
        };
    }
    
    // Base inspection function for prefilters and transports
    function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {
    
        var inspected = {},
            seekingTransport = ( structure === transports );
    
        function inspect( dataType ) {
            var selected;
            inspected[ dataType ] = true;
            jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
                var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
                if ( typeof dataTypeOrTransport === "string" &&
                    !seekingTransport && !inspected[ dataTypeOrTransport ] ) {
    
                    options.dataTypes.unshift( dataTypeOrTransport );
                    inspect( dataTypeOrTransport );
                    return false;
                } else if ( seekingTransport ) {
                    return !( selected = dataTypeOrTransport );
                }
            } );
            return selected;
        }
    
        return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
    }
    
    // A special extend for ajax options
    // that takes "flat" options (not to be deep extended)
    // Fixes #9887
    function ajaxExtend( target, src ) {
        var key, deep,
            flatOptions = jQuery.ajaxSettings.flatOptions || {};
    
        for ( key in src ) {
            if ( src[ key ] !== undefined ) {
                ( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
            }
        }
        if ( deep ) {
            jQuery.extend( true, target, deep );
        }
    
        return target;
    }
    
    /* Handles responses to an ajax request:
     * - finds the right dataType (mediates between content-type and expected dataType)
     * - returns the corresponding response
     */
    function ajaxHandleResponses( s, jqXHR, responses ) {
    
        var ct, type, finalDataType, firstDataType,
            contents = s.contents,
            dataTypes = s.dataTypes;
    
        // Remove auto dataType and get content-type in the process
        while ( dataTypes[ 0 ] === "*" ) {
            dataTypes.shift();
            if ( ct === undefined ) {
                ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
            }
        }
    
        // Check if we're dealing with a known content-type
        if ( ct ) {
            for ( type in contents ) {
                if ( contents[ type ] && contents[ type ].test( ct ) ) {
                    dataTypes.unshift( type );
                    break;
                }
            }
        }
    
        // Check to see if we have a response for the expected dataType
        if ( dataTypes[ 0 ] in responses ) {
            finalDataType = dataTypes[ 0 ];
        } else {
    
            // Try convertible dataTypes
            for ( type in responses ) {
                if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
                    finalDataType = type;
                    break;
                }
                if ( !firstDataType ) {
                    firstDataType = type;
                }
            }
    
            // Or just use first one
            finalDataType = finalDataType || firstDataType;
        }
    
        // If we found a dataType
        // We add the dataType to the list if needed
        // and return the corresponding response
        if ( finalDataType ) {
            if ( finalDataType !== dataTypes[ 0 ] ) {
                dataTypes.unshift( finalDataType );
            }
            return responses[ finalDataType ];
        }
    }
    
    /* Chain conversions given the request and the original response
     * Also sets the responseXXX fields on the jqXHR instance
     */
    function ajaxConvert( s, response, jqXHR, isSuccess ) {
        var conv2, current, conv, tmp, prev,
            converters = {},
    
            // Work with a copy of dataTypes in case we need to modify it for conversion
            dataTypes = s.dataTypes.slice();
    
        // Create converters map with lowercased keys
        if ( dataTypes[ 1 ] ) {
            for ( conv in s.converters ) {
                converters[ conv.toLowerCase() ] = s.converters[ conv ];
            }
        }
    
        current = dataTypes.shift();
    
        // Convert to each sequential dataType
        while ( current ) {
    
            if ( s.responseFields[ current ] ) {
                jqXHR[ s.responseFields[ current ] ] = response;
            }
    
            // Apply the dataFilter if provided
            if ( !prev && isSuccess && s.dataFilter ) {
                response = s.dataFilter( response, s.dataType );
            }
    
            prev = current;
            current = dataTypes.shift();
    
            if ( current ) {
    
                // There's only work to do if current dataType is non-auto
                if ( current === "*" ) {
    
                    current = prev;
    
                // Convert response if prev dataType is non-auto and differs from current
                } else if ( prev !== "*" && prev !== current ) {
    
                    // Seek a direct converter
                    conv = converters[ prev + " " + current ] || converters[ "* " + current ];
    
                    // If none found, seek a pair
                    if ( !conv ) {
                        for ( conv2 in converters ) {
    
                            // If conv2 outputs current
                            tmp = conv2.split( " " );
                            if ( tmp[ 1 ] === current ) {
    
                                // If prev can be converted to accepted input
                                conv = converters[ prev + " " + tmp[ 0 ] ] ||
                                    converters[ "* " + tmp[ 0 ] ];
                                if ( conv ) {
    
                                    // Condense equivalence converters
                                    if ( conv === true ) {
                                        conv = converters[ conv2 ];
    
                                    // Otherwise, insert the intermediate dataType
                                    } else if ( converters[ conv2 ] !== true ) {
                                        current = tmp[ 0 ];
                                        dataTypes.unshift( tmp[ 1 ] );
                                    }
                                    break;
                                }
                            }
                        }
                    }
    
                    // Apply converter (if not an equivalence)
                    if ( conv !== true ) {
    
                        // Unless errors are allowed to bubble, catch and return them
                        if ( conv && s.throws ) {
                            response = conv( response );
                        } else {
                            try {
                                response = conv( response );
                            } catch ( e ) {
                                return {
                                    state: "parsererror",
                                    error: conv ? e : "No conversion from " + prev + " to " + current
                                };
                            }
                        }
                    }
                }
            }
        }
    
        return { state: "success", data: response };
    }
    
    jQuery.extend( {
    
        // Counter for holding the number of active queries
        active: 0,
    
        // Last-Modified header cache for next request
        lastModified: {},
        etag: {},
    
        ajaxSettings: {
            url: location.href,
            type: "GET",
            isLocal: rlocalProtocol.test( location.protocol ),
            global: true,
            processData: true,
            async: true,
            contentType: "application/x-www-form-urlencoded; charset=UTF-8",
    
            /*
            timeout: 0,
            data: null,
            dataType: null,
            username: null,
            password: null,
            cache: null,
            throws: false,
            traditional: false,
            headers: {},
            */
    
            accepts: {
                "*": allTypes,
                text: "text/plain",
                html: "text/html",
                xml: "application/xml, text/xml",
                json: "application/json, text/javascript"
            },
    
            contents: {
                xml: /\bxml\b/,
                html: /\bhtml/,
                json: /\bjson\b/
            },
    
            responseFields: {
                xml: "responseXML",
                text: "responseText",
                json: "responseJSON"
            },
    
            // Data converters
            // Keys separate source (or catchall "*") and destination types with a single space
            converters: {
    
                // Convert anything to text
                "* text": String,
    
                // Text to html (true = no transformation)
                "text html": true,
    
                // Evaluate text as a json expression
                "text json": JSON.parse,
    
                // Parse text as xml
                "text xml": jQuery.parseXML
            },
    
            // For options that shouldn't be deep extended:
            // you can add your own custom options here if
            // and when you create one that shouldn't be
            // deep extended (see ajaxExtend)
            flatOptions: {
                url: true,
                context: true
            }
        },
    
        // Creates a full fledged settings object into target
        // with both ajaxSettings and settings fields.
        // If target is omitted, writes into ajaxSettings.
        ajaxSetup: function( target, settings ) {
            return settings ?
    
                // Building a settings object
                ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :
    
                // Extending ajaxSettings
                ajaxExtend( jQuery.ajaxSettings, target );
        },
    
        ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
        ajaxTransport: addToPrefiltersOrTransports( transports ),
    
        // Main method
        ajax: function( url, options ) {
    
            // If url is an object, simulate pre-1.5 signature
            if ( typeof url === "object" ) {
                options = url;
                url = undefined;
            }
    
            // Force options to be an object
            options = options || {};
    
            var transport,
    
                // URL without anti-cache param
                cacheURL,
    
                // Response headers
                responseHeadersString,
                responseHeaders,
    
                // timeout handle
                timeoutTimer,
    
                // Url cleanup var
                urlAnchor,
    
                // Request state (becomes false upon send and true upon completion)
                completed,
    
                // To know if global events are to be dispatched
                fireGlobals,
    
                // Loop variable
                i,
    
                // uncached part of the url
                uncached,
    
                // Create the final options object
                s = jQuery.ajaxSetup( {}, options ),
    
                // Callbacks context
                callbackContext = s.context || s,
    
                // Context for global events is callbackContext if it is a DOM node or jQuery collection
                globalEventContext = s.context &&
                    ( callbackContext.nodeType || callbackContext.jquery ) ?
                        jQuery( callbackContext ) :
                        jQuery.event,
    
                // Deferreds
                deferred = jQuery.Deferred(),
                completeDeferred = jQuery.Callbacks( "once memory" ),
    
                // Status-dependent callbacks
                statusCode = s.statusCode || {},
    
                // Headers (they are sent all at once)
                requestHeaders = {},
                requestHeadersNames = {},
    
                // Default abort message
                strAbort = "canceled",
    
                // Fake xhr
                jqXHR = {
                    readyState: 0,
    
                    // Builds headers hashtable if needed
                    getResponseHeader: function( key ) {
                        var match;
                        if ( completed ) {
                            if ( !responseHeaders ) {
                                responseHeaders = {};
                                while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
                                    responseHeaders[ match[ 1 ].toLowerCase() ] = match[ 2 ];
                                }
                            }
                            match = responseHeaders[ key.toLowerCase() ];
                        }
                        return match == null ? null : match;
                    },
    
                    // Raw string
                    getAllResponseHeaders: function() {
                        return completed ? responseHeadersString : null;
                    },
    
                    // Caches the header
                    setRequestHeader: function( name, value ) {
                        if ( completed == null ) {
                            name = requestHeadersNames[ name.toLowerCase() ] =
                                requestHeadersNames[ name.toLowerCase() ] || name;
                            requestHeaders[ name ] = value;
                        }
                        return this;
                    },
    
                    // Overrides response content-type header
                    overrideMimeType: function( type ) {
                        if ( completed == null ) {
                            s.mimeType = type;
                        }
                        return this;
                    },
    
                    // Status-dependent callbacks
                    statusCode: function( map ) {
                        var code;
                        if ( map ) {
                            if ( completed ) {
    
                                // Execute the appropriate callbacks
                                jqXHR.always( map[ jqXHR.status ] );
                            } else {
    
                                // Lazy-add the new callbacks in a way that preserves old ones
                                for ( code in map ) {
                                    statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
                                }
                            }
                        }
                        return this;
                    },
    
                    // Cancel the request
                    abort: function( statusText ) {
                        var finalText = statusText || strAbort;
                        if ( transport ) {
                            transport.abort( finalText );
                        }
                        done( 0, finalText );
                        return this;
                    }
                };
    
            // Attach deferreds
            deferred.promise( jqXHR );
    
            // Add protocol if not provided (prefilters might expect it)
            // Handle falsy url in the settings object (#10093: consistency with old signature)
            // We also use the url parameter if available
            s.url = ( ( url || s.url || location.href ) + "" )
                .replace( rprotocol, location.protocol + "//" );
    
            // Alias method option to type as per ticket #12004
            s.type = options.method || options.type || s.method || s.type;
    
            // Extract dataTypes list
            s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];
    
            // A cross-domain request is in order when the origin doesn't match the current origin.
            if ( s.crossDomain == null ) {
                urlAnchor = document.createElement( "a" );
    
                // Support: IE <=8 - 11, Edge 12 - 13
                // IE throws exception on accessing the href property if url is malformed,
                // e.g. http://example.com:80x/
                try {
                    urlAnchor.href = s.url;
    
                    // Support: IE <=8 - 11 only
                    // Anchor's host property isn't correctly set when s.url is relative
                    urlAnchor.href = urlAnchor.href;
                    s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
                        urlAnchor.protocol + "//" + urlAnchor.host;
                } catch ( e ) {
    
                    // If there is an error parsing the URL, assume it is crossDomain,
                    // it can be rejected by the transport if it is invalid
                    s.crossDomain = true;
                }
            }
    
            // Convert data if not already a string
            if ( s.data && s.processData && typeof s.data !== "string" ) {
                s.data = jQuery.param( s.data, s.traditional );
            }
    
            // Apply prefilters
            inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );
    
            // If request was aborted inside a prefilter, stop there
            if ( completed ) {
                return jqXHR;
            }
    
            // We can fire global events as of now if asked to
            // Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
            fireGlobals = jQuery.event && s.global;
    
            // Watch for a new set of requests
            if ( fireGlobals && jQuery.active++ === 0 ) {
                jQuery.event.trigger( "ajaxStart" );
            }
    
            // Uppercase the type
            s.type = s.type.toUpperCase();
    
            // Determine if request has content
            s.hasContent = !rnoContent.test( s.type );
    
            // Save the URL in case we're toying with the If-Modified-Since
            // and/or If-None-Match header later on
            // Remove hash to simplify url manipulation
            cacheURL = s.url.replace( rhash, "" );
    
            // More options handling for requests with no content
            if ( !s.hasContent ) {
    
                // Remember the hash so we can put it back
                uncached = s.url.slice( cacheURL.length );
    
                // If data is available, append data to url
                if ( s.data ) {
                    cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;
    
                    // #9682: remove data so that it's not used in an eventual retry
                    delete s.data;
                }
    
                // Add or update anti-cache param if needed
                if ( s.cache === false ) {
                    cacheURL = cacheURL.replace( rantiCache, "$1" );
                    uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce++ ) + uncached;
                }
    
                // Put hash and anti-cache on the URL that will be requested (gh-1732)
                s.url = cacheURL + uncached;
    
            // Change '%20' to '+' if this is encoded form body content (gh-2658)
            } else if ( s.data && s.processData &&
                ( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
                s.data = s.data.replace( r20, "+" );
            }
    
            // Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
            if ( s.ifModified ) {
                if ( jQuery.lastModified[ cacheURL ] ) {
                    jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
                }
                if ( jQuery.etag[ cacheURL ] ) {
                    jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
                }
            }
    
            // Set the correct header, if data is being sent
            if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
                jqXHR.setRequestHeader( "Content-Type", s.contentType );
            }
    
            // Set the Accepts header for the server, depending on the dataType
            jqXHR.setRequestHeader(
                "Accept",
                s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
                    s.accepts[ s.dataTypes[ 0 ] ] +
                        ( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
                    s.accepts[ "*" ]
            );
    
            // Check for headers option
            for ( i in s.headers ) {
                jqXHR.setRequestHeader( i, s.headers[ i ] );
            }
    
            // Allow custom headers/mimetypes and early abort
            if ( s.beforeSend &&
                ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {
    
                // Abort if not done already and return
                return jqXHR.abort();
            }
    
            // Aborting is no longer a cancellation
            strAbort = "abort";
    
            // Install callbacks on deferreds
            completeDeferred.add( s.complete );
            jqXHR.done( s.success );
            jqXHR.fail( s.error );
    
            // Get transport
            transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );
    
            // If no transport, we auto-abort
            if ( !transport ) {
                done( -1, "No Transport" );
            } else {
                jqXHR.readyState = 1;
    
                // Send global event
                if ( fireGlobals ) {
                    globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
                }
    
                // If request was aborted inside ajaxSend, stop there
                if ( completed ) {
                    return jqXHR;
                }
    
                // Timeout
                if ( s.async && s.timeout > 0 ) {
                    timeoutTimer = window.setTimeout( function() {
                        jqXHR.abort( "timeout" );
                    }, s.timeout );
                }
    
                try {
                    completed = false;
                    transport.send( requestHeaders, done );
                } catch ( e ) {
    
                    // Rethrow post-completion exceptions
                    if ( completed ) {
                        throw e;
                    }
    
                    // Propagate others as results
                    done( -1, e );
                }
            }
    
            // Callback for when everything is done
            function done( status, nativeStatusText, responses, headers ) {
                var isSuccess, success, error, response, modified,
                    statusText = nativeStatusText;
    
                // Ignore repeat invocations
                if ( completed ) {
                    return;
                }
    
                completed = true;
    
                // Clear timeout if it exists
                if ( timeoutTimer ) {
                    window.clearTimeout( timeoutTimer );
                }
    
                // Dereference transport for early garbage collection
                // (no matter how long the jqXHR object will be used)
                transport = undefined;
    
                // Cache response headers
                responseHeadersString = headers || "";
    
                // Set readyState
                jqXHR.readyState = status > 0 ? 4 : 0;
    
                // Determine if successful
                isSuccess = status >= 200 && status < 300 || status === 304;
    
                // Get response data
                if ( responses ) {
                    response = ajaxHandleResponses( s, jqXHR, responses );
                }
    
                // Convert no matter what (that way responseXXX fields are always set)
                response = ajaxConvert( s, response, jqXHR, isSuccess );
    
                // If successful, handle type chaining
                if ( isSuccess ) {
    
                    // Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
                    if ( s.ifModified ) {
                        modified = jqXHR.getResponseHeader( "Last-Modified" );
                        if ( modified ) {
                            jQuery.lastModified[ cacheURL ] = modified;
                        }
                        modified = jqXHR.getResponseHeader( "etag" );
                        if ( modified ) {
                            jQuery.etag[ cacheURL ] = modified;
                        }
                    }
    
                    // if no content
                    if ( status === 204 || s.type === "HEAD" ) {
                        statusText = "nocontent";
    
                    // if not modified
                    } else if ( status === 304 ) {
                        statusText = "notmodified";
    
                    // If we have data, let's convert it
                    } else {
                        statusText = response.state;
                        success = response.data;
                        error = response.error;
                        isSuccess = !error;
                    }
                } else {
    
                    // Extract error from statusText and normalize for non-aborts
                    error = statusText;
                    if ( status || !statusText ) {
                        statusText = "error";
                        if ( status < 0 ) {
                            status = 0;
                        }
                    }
                }
    
                // Set data for the fake xhr object
                jqXHR.status = status;
                jqXHR.statusText = ( nativeStatusText || statusText ) + "";
    
                // Success/Error
                if ( isSuccess ) {
                    deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
                } else {
                    deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
                }
    
                // Status-dependent callbacks
                jqXHR.statusCode( statusCode );
                statusCode = undefined;
    
                if ( fireGlobals ) {
                    globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
                        [ jqXHR, s, isSuccess ? success : error ] );
                }
    
                // Complete
                completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );
    
                if ( fireGlobals ) {
                    globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );
    
                    // Handle the global AJAX counter
                    if ( !( --jQuery.active ) ) {
                        jQuery.event.trigger( "ajaxStop" );
                    }
                }
            }
    
            return jqXHR;
        },
    
        getJSON: function( url, data, callback ) {
            return jQuery.get( url, data, callback, "json" );
        },
    
        getScript: function( url, callback ) {
            return jQuery.get( url, undefined, callback, "script" );
        }
    } );
    
    jQuery.each( [ "get", "post" ], function( i, method ) {
        jQuery[ method ] = function( url, data, callback, type ) {
    
            // Shift arguments if data argument was omitted
            if ( jQuery.isFunction( data ) ) {
                type = type || callback;
                callback = data;
                data = undefined;
            }
    
            // The url can be an options object (which then must have .url)
            return jQuery.ajax( jQuery.extend( {
                url: url,
                type: method,
                dataType: type,
                data: data,
                success: callback
            }, jQuery.isPlainObject( url ) && url ) );
        };
    } );
    
    
    jQuery._evalUrl = function( url ) {
        return jQuery.ajax( {
            url: url,
    
            // Make this explicit, since user can override this through ajaxSetup (#11264)
            type: "GET",
            dataType: "script",
            cache: true,
            async: false,
            global: false,
            "throws": true
        } );
    };
    
    
    jQuery.fn.extend( {
        wrapAll: function( html ) {
            var wrap;
    
            if ( this[ 0 ] ) {
                if ( jQuery.isFunction( html ) ) {
                    html = html.call( this[ 0 ] );
                }
    
                // The elements to wrap the target around
                wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );
    
                if ( this[ 0 ].parentNode ) {
                    wrap.insertBefore( this[ 0 ] );
                }
    
                wrap.map( function() {
                    var elem = this;
    
                    while ( elem.firstElementChild ) {
                        elem = elem.firstElementChild;
                    }
    
                    return elem;
                } ).append( this );
            }
    
            return this;
        },
    
        wrapInner: function( html ) {
            if ( jQuery.isFunction( html ) ) {
                return this.each( function( i ) {
                    jQuery( this ).wrapInner( html.call( this, i ) );
                } );
            }
    
            return this.each( function() {
                var self = jQuery( this ),
                    contents = self.contents();
    
                if ( contents.length ) {
                    contents.wrapAll( html );
    
                } else {
                    self.append( html );
                }
            } );
        },
    
        wrap: function( html ) {
            var isFunction = jQuery.isFunction( html );
    
            return this.each( function( i ) {
                jQuery( this ).wrapAll( isFunction ? html.call( this, i ) : html );
            } );
        },
    
        unwrap: function( selector ) {
            this.parent( selector ).not( "body" ).each( function() {
                jQuery( this ).replaceWith( this.childNodes );
            } );
            return this;
        }
    } );
    
    
    jQuery.expr.pseudos.hidden = function( elem ) {
        return !jQuery.expr.pseudos.visible( elem );
    };
    jQuery.expr.pseudos.visible = function( elem ) {
        return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
    };
    
    
    
    
    jQuery.ajaxSettings.xhr = function() {
        try {
            return new window.XMLHttpRequest();
        } catch ( e ) {}
    };
    
    var xhrSuccessStatus = {
    
            // File protocol always yields status code 0, assume 200
            0: 200,
    
            // Support: IE <=9 only
            // #1450: sometimes IE returns 1223 when it should be 204
            1223: 204
        },
        xhrSupported = jQuery.ajaxSettings.xhr();
    
    support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
    support.ajax = xhrSupported = !!xhrSupported;
    
    jQuery.ajaxTransport( function( options ) {
        var callback, errorCallback;
    
        // Cross domain only allowed if supported through XMLHttpRequest
        if ( support.cors || xhrSupported && !options.crossDomain ) {
            return {
                send: function( headers, complete ) {
                    var i,
                        xhr = options.xhr();
    
                    xhr.open(
                        options.type,
                        options.url,
                        options.async,
                        options.username,
                        options.password
                    );
    
                    // Apply custom fields if provided
                    if ( options.xhrFields ) {
                        for ( i in options.xhrFields ) {
                            xhr[ i ] = options.xhrFields[ i ];
                        }
                    }
    
                    // Override mime type if needed
                    if ( options.mimeType && xhr.overrideMimeType ) {
                        xhr.overrideMimeType( options.mimeType );
                    }
    
                    // X-Requested-With header
                    // For cross-domain requests, seeing as conditions for a preflight are
                    // akin to a jigsaw puzzle, we simply never set it to be sure.
                    // (it can always be set on a per-request basis or even using ajaxSetup)
                    // For same-domain requests, won't change header if already provided.
                    if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
                        headers[ "X-Requested-With" ] = "XMLHttpRequest";
                    }
    
                    // Set headers
                    for ( i in headers ) {
                        xhr.setRequestHeader( i, headers[ i ] );
                    }
    
                    // Callback
                    callback = function( type ) {
                        return function() {
                            if ( callback ) {
                                callback = errorCallback = xhr.onload =
                                    xhr.onerror = xhr.onabort = xhr.onreadystatechange = null;
    
                                if ( type === "abort" ) {
                                    xhr.abort();
                                } else if ( type === "error" ) {
    
                                    // Support: IE <=9 only
                                    // On a manual native abort, IE9 throws
                                    // errors on any property access that is not readyState
                                    if ( typeof xhr.status !== "number" ) {
                                        complete( 0, "error" );
                                    } else {
                                        complete(
    
                                            // File: protocol always yields status 0; see #8605, #14207
                                            xhr.status,
                                            xhr.statusText
                                        );
                                    }
                                } else {
                                    complete(
                                        xhrSuccessStatus[ xhr.status ] || xhr.status,
                                        xhr.statusText,
    
                                        // Support: IE <=9 only
                                        // IE9 has no XHR2 but throws on binary (trac-11426)
                                        // For XHR2 non-text, let the caller handle it (gh-2498)
                                        ( xhr.responseType || "text" ) !== "text"  ||
                                        typeof xhr.responseText !== "string" ?
                                            { binary: xhr.response } :
                                            { text: xhr.responseText },
                                        xhr.getAllResponseHeaders()
                                    );
                                }
                            }
                        };
                    };
    
                    // Listen to events
                    xhr.onload = callback();
                    errorCallback = xhr.onerror = callback( "error" );
    
                    // Support: IE 9 only
                    // Use onreadystatechange to replace onabort
                    // to handle uncaught aborts
                    if ( xhr.onabort !== undefined ) {
                        xhr.onabort = errorCallback;
                    } else {
                        xhr.onreadystatechange = function() {
    
                            // Check readyState before timeout as it changes
                            if ( xhr.readyState === 4 ) {
    
                                // Allow onerror to be called first,
                                // but that will not handle a native abort
                                // Also, save errorCallback to a variable
                                // as xhr.onerror cannot be accessed
                                window.setTimeout( function() {
                                    if ( callback ) {
                                        errorCallback();
                                    }
                                } );
                            }
                        };
                    }
    
                    // Create the abort callback
                    callback = callback( "abort" );
    
                    try {
    
                        // Do send the request (this may raise an exception)
                        xhr.send( options.hasContent && options.data || null );
                    } catch ( e ) {
    
                        // #14683: Only rethrow if this hasn't been notified as an error yet
                        if ( callback ) {
                            throw e;
                        }
                    }
                },
    
                abort: function() {
                    if ( callback ) {
                        callback();
                    }
                }
            };
        }
    } );
    
    
    
    
    // Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
    jQuery.ajaxPrefilter( function( s ) {
        if ( s.crossDomain ) {
            s.contents.script = false;
        }
    } );
    
    // Install script dataType
    jQuery.ajaxSetup( {
        accepts: {
            script: "text/javascript, application/javascript, " +
                "application/ecmascript, application/x-ecmascript"
        },
        contents: {
            script: /\b(?:java|ecma)script\b/
        },
        converters: {
            "text script": function( text ) {
                jQuery.globalEval( text );
                return text;
            }
        }
    } );
    
    // Handle cache's special case and crossDomain
    jQuery.ajaxPrefilter( "script", function( s ) {
        if ( s.cache === undefined ) {
            s.cache = false;
        }
        if ( s.crossDomain ) {
            s.type = "GET";
        }
    } );
    
    // Bind script tag hack transport
    jQuery.ajaxTransport( "script", function( s ) {
    
        // This transport only deals with cross domain requests
        if ( s.crossDomain ) {
            var script, callback;
            return {
                send: function( _, complete ) {
                    script = jQuery( "<script>" ).prop( {
                        charset: s.scriptCharset,
                        src: s.url
                    } ).on(
                        "load error",
                        callback = function( evt ) {
                            script.remove();
                            callback = null;
                            if ( evt ) {
                                complete( evt.type === "error" ? 404 : 200, evt.type );
                            }
                        }
                    );
    
                    // Use native DOM manipulation to avoid our domManip AJAX trickery
                    document.head.appendChild( script[ 0 ] );
                },
                abort: function() {
                    if ( callback ) {
                        callback();
                    }
                }
            };
        }
    } );
    
    
    
    
    var oldCallbacks = [],
        rjsonp = /(=)\?(?=&|$)|\?\?/;
    
    // Default jsonp settings
    jQuery.ajaxSetup( {
        jsonp: "callback",
        jsonpCallback: function() {
            var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
            this[ callback ] = true;
            return callback;
        }
    } );
    
    // Detect, normalize options and install callbacks for jsonp requests
    jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {
    
        var callbackName, overwritten, responseContainer,
            jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
                "url" :
                typeof s.data === "string" &&
                    ( s.contentType || "" )
                        .indexOf( "application/x-www-form-urlencoded" ) === 0 &&
                    rjsonp.test( s.data ) && "data"
            );
    
        // Handle iff the expected data type is "jsonp" or we have a parameter to set
        if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {
    
            // Get callback name, remembering preexisting value associated with it
            callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
                s.jsonpCallback() :
                s.jsonpCallback;
    
            // Insert callback into url or form data
            if ( jsonProp ) {
                s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
            } else if ( s.jsonp !== false ) {
                s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
            }
    
            // Use data converter to retrieve json after script execution
            s.converters[ "script json" ] = function() {
                if ( !responseContainer ) {
                    jQuery.error( callbackName + " was not called" );
                }
                return responseContainer[ 0 ];
            };
    
            // Force json dataType
            s.dataTypes[ 0 ] = "json";
    
            // Install callback
            overwritten = window[ callbackName ];
            window[ callbackName ] = function() {
                responseContainer = arguments;
            };
    
            // Clean-up function (fires after converters)
            jqXHR.always( function() {
    
                // If previous value didn't exist - remove it
                if ( overwritten === undefined ) {
                    jQuery( window ).removeProp( callbackName );
    
                // Otherwise restore preexisting value
                } else {
                    window[ callbackName ] = overwritten;
                }
    
                // Save back as free
                if ( s[ callbackName ] ) {
    
                    // Make sure that re-using the options doesn't screw things around
                    s.jsonpCallback = originalSettings.jsonpCallback;
    
                    // Save the callback name for future use
                    oldCallbacks.push( callbackName );
                }
    
                // Call if it was a function and we have a response
                if ( responseContainer && jQuery.isFunction( overwritten ) ) {
                    overwritten( responseContainer[ 0 ] );
                }
    
                responseContainer = overwritten = undefined;
            } );
    
            // Delegate to script
            return "script";
        }
    } );
    
    
    
    
    // Support: Safari 8 only
    // In Safari 8 documents created via document.implementation.createHTMLDocument
    // collapse sibling forms: the second one becomes a child of the first one.
    // Because of that, this security measure has to be disabled in Safari 8.
    // https://bugs.webkit.org/show_bug.cgi?id=137337
    support.createHTMLDocument = ( function() {
        var body = document.implementation.createHTMLDocument( "" ).body;
        body.innerHTML = "<form></form><form></form>";
        return body.childNodes.length === 2;
    } )();
    
    
    // Argument "data" should be string of html
    // context (optional): If specified, the fragment will be created in this context,
    // defaults to document
    // keepScripts (optional): If true, will include scripts passed in the html string
    jQuery.parseHTML = function( data, context, keepScripts ) {
        if ( typeof data !== "string" ) {
            return [];
        }
        if ( typeof context === "boolean" ) {
            keepScripts = context;
            context = false;
        }
    
        var base, parsed, scripts;
    
        if ( !context ) {
    
            // Stop scripts or inline event handlers from being executed immediately
            // by using document.implementation
            if ( support.createHTMLDocument ) {
                context = document.implementation.createHTMLDocument( "" );
    
                // Set the base href for the created document
                // so any parsed elements with URLs
                // are based on the document's URL (gh-2965)
                base = context.createElement( "base" );
                base.href = document.location.href;
                context.head.appendChild( base );
            } else {
                context = document;
            }
        }
    
        parsed = rsingleTag.exec( data );
        scripts = !keepScripts && [];
    
        // Single tag
        if ( parsed ) {
            return [ context.createElement( parsed[ 1 ] ) ];
        }
    
        parsed = buildFragment( [ data ], context, scripts );
    
        if ( scripts && scripts.length ) {
            jQuery( scripts ).remove();
        }
    
        return jQuery.merge( [], parsed.childNodes );
    };
    
    
    /**
     * Load a url into a page
     */
    jQuery.fn.load = function( url, params, callback ) {
        var selector, type, response,
            self = this,
            off = url.indexOf( " " );
    
        if ( off > -1 ) {
            selector = stripAndCollapse( url.slice( off ) );
            url = url.slice( 0, off );
        }
    
        // If it's a function
        if ( jQuery.isFunction( params ) ) {
    
            // We assume that it's the callback
            callback = params;
            params = undefined;
    
        // Otherwise, build a param string
        } else if ( params && typeof params === "object" ) {
            type = "POST";
        }
    
        // If we have elements to modify, make the request
        if ( self.length > 0 ) {
            jQuery.ajax( {
                url: url,
    
                // If "type" variable is undefined, then "GET" method will be used.
                // Make value of this field explicit since
                // user can override it through ajaxSetup method
                type: type || "GET",
                dataType: "html",
                data: params
            } ).done( function( responseText ) {
    
                // Save response for use in complete callback
                response = arguments;
    
                self.html( selector ?
    
                    // If a selector was specified, locate the right elements in a dummy div
                    // Exclude scripts to avoid IE 'Permission Denied' errors
                    jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :
    
                    // Otherwise use the full result
                    responseText );
    
            // If the request succeeds, this function gets "data", "status", "jqXHR"
            // but they are ignored because response was set above.
            // If it fails, this function gets "jqXHR", "status", "error"
            } ).always( callback && function( jqXHR, status ) {
                self.each( function() {
                    callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
                } );
            } );
        }
    
        return this;
    };
    
    
    
    
    // Attach a bunch of functions for handling common AJAX events
    jQuery.each( [
        "ajaxStart",
        "ajaxStop",
        "ajaxComplete",
        "ajaxError",
        "ajaxSuccess",
        "ajaxSend"
    ], function( i, type ) {
        jQuery.fn[ type ] = function( fn ) {
            return this.on( type, fn );
        };
    } );
    
    
    
    
    jQuery.expr.pseudos.animated = function( elem ) {
        return jQuery.grep( jQuery.timers, function( fn ) {
            return elem === fn.elem;
        } ).length;
    };
    
    
    
    
    /**
     * Gets a window from an element
     */
    function getWindow( elem ) {
        return jQuery.isWindow( elem ) ? elem : elem.nodeType === 9 && elem.defaultView;
    }
    
    jQuery.offset = {
        setOffset: function( elem, options, i ) {
            var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
                position = jQuery.css( elem, "position" ),
                curElem = jQuery( elem ),
                props = {};
    
            // Set position first, in-case top/left are set even on static elem
            if ( position === "static" ) {
                elem.style.position = "relative";
            }
    
            curOffset = curElem.offset();
            curCSSTop = jQuery.css( elem, "top" );
            curCSSLeft = jQuery.css( elem, "left" );
            calculatePosition = ( position === "absolute" || position === "fixed" ) &&
                ( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;
    
            // Need to be able to calculate position if either
            // top or left is auto and position is either absolute or fixed
            if ( calculatePosition ) {
                curPosition = curElem.position();
                curTop = curPosition.top;
                curLeft = curPosition.left;
    
            } else {
                curTop = parseFloat( curCSSTop ) || 0;
                curLeft = parseFloat( curCSSLeft ) || 0;
            }
    
            if ( jQuery.isFunction( options ) ) {
    
                // Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
                options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
            }
    
            if ( options.top != null ) {
                props.top = ( options.top - curOffset.top ) + curTop;
            }
            if ( options.left != null ) {
                props.left = ( options.left - curOffset.left ) + curLeft;
            }
    
            if ( "using" in options ) {
                options.using.call( elem, props );
    
            } else {
                curElem.css( props );
            }
        }
    };
    
    jQuery.fn.extend( {
        offset: function( options ) {
    
            // Preserve chaining for setter
            if ( arguments.length ) {
                return options === undefined ?
                    this :
                    this.each( function( i ) {
                        jQuery.offset.setOffset( this, options, i );
                    } );
            }
    
            var docElem, win, rect, doc,
                elem = this[ 0 ];
    
            if ( !elem ) {
                return;
            }
    
            // Support: IE <=11 only
            // Running getBoundingClientRect on a
            // disconnected node in IE throws an error
            if ( !elem.getClientRects().length ) {
                return { top: 0, left: 0 };
            }
    
            rect = elem.getBoundingClientRect();
    
            // Make sure element is not hidden (display: none)
            if ( rect.width || rect.height ) {
                doc = elem.ownerDocument;
                win = getWindow( doc );
                docElem = doc.documentElement;
    
                return {
                    top: rect.top + win.pageYOffset - docElem.clientTop,
                    left: rect.left + win.pageXOffset - docElem.clientLeft
                };
            }
    
            // Return zeros for disconnected and hidden elements (gh-2310)
            return rect;
        },
    
        position: function() {
            if ( !this[ 0 ] ) {
                return;
            }
    
            var offsetParent, offset,
                elem = this[ 0 ],
                parentOffset = { top: 0, left: 0 };
    
            // Fixed elements are offset from window (parentOffset = {top:0, left: 0},
            // because it is its only offset parent
            if ( jQuery.css( elem, "position" ) === "fixed" ) {
    
                // Assume getBoundingClientRect is there when computed position is fixed
                offset = elem.getBoundingClientRect();
    
            } else {
    
                // Get *real* offsetParent
                offsetParent = this.offsetParent();
    
                // Get correct offsets
                offset = this.offset();
                if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
                    parentOffset = offsetParent.offset();
                }
    
                // Add offsetParent borders
                parentOffset = {
                    top: parentOffset.top + jQuery.css( offsetParent[ 0 ], "borderTopWidth", true ),
                    left: parentOffset.left + jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true )
                };
            }
    
            // Subtract parent offsets and element margins
            return {
                top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
                left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
            };
        },
    
        // This method will return documentElement in the following cases:
        // 1) For the element inside the iframe without offsetParent, this method will return
        //    documentElement of the parent window
        // 2) For the hidden or detached element
        // 3) For body or html element, i.e. in case of the html node - it will return itself
        //
        // but those exceptions were never presented as a real life use-cases
        // and might be considered as more preferable results.
        //
        // This logic, however, is not guaranteed and can change at any point in the future
        offsetParent: function() {
            return this.map( function() {
                var offsetParent = this.offsetParent;
    
                while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
                    offsetParent = offsetParent.offsetParent;
                }
    
                return offsetParent || documentElement;
            } );
        }
    } );
    
    // Create scrollLeft and scrollTop methods
    jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
        var top = "pageYOffset" === prop;
    
        jQuery.fn[ method ] = function( val ) {
            return access( this, function( elem, method, val ) {
                var win = getWindow( elem );
    
                if ( val === undefined ) {
                    return win ? win[ prop ] : elem[ method ];
                }
    
                if ( win ) {
                    win.scrollTo(
                        !top ? val : win.pageXOffset,
                        top ? val : win.pageYOffset
                    );
    
                } else {
                    elem[ method ] = val;
                }
            }, method, val, arguments.length );
        };
    } );
    
    // Support: Safari <=7 - 9.1, Chrome <=37 - 49
    // Add the top/left cssHooks using jQuery.fn.position
    // Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
    // Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
    // getComputedStyle returns percent when specified for top/left/bottom/right;
    // rather than make the css module depend on the offset module, just check for it here
    jQuery.each( [ "top", "left" ], function( i, prop ) {
        jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
            function( elem, computed ) {
                if ( computed ) {
                    computed = curCSS( elem, prop );
    
                    // If curCSS returns percentage, fallback to offset
                    return rnumnonpx.test( computed ) ?
                        jQuery( elem ).position()[ prop ] + "px" :
                        computed;
                }
            }
        );
    } );
    
    
    // Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
    jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
        jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name },
            function( defaultExtra, funcName ) {
    
            // Margin is only for outerHeight, outerWidth
            jQuery.fn[ funcName ] = function( margin, value ) {
                var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
                    extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );
    
                return access( this, function( elem, type, value ) {
                    var doc;
    
                    if ( jQuery.isWindow( elem ) ) {
    
                        // $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
                        return funcName.indexOf( "outer" ) === 0 ?
                            elem[ "inner" + name ] :
                            elem.document.documentElement[ "client" + name ];
                    }
    
                    // Get document width or height
                    if ( elem.nodeType === 9 ) {
                        doc = elem.documentElement;
    
                        // Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
                        // whichever is greatest
                        return Math.max(
                            elem.body[ "scroll" + name ], doc[ "scroll" + name ],
                            elem.body[ "offset" + name ], doc[ "offset" + name ],
                            doc[ "client" + name ]
                        );
                    }
    
                    return value === undefined ?
    
                        // Get width or height on the element, requesting but not forcing parseFloat
                        jQuery.css( elem, type, extra ) :
    
                        // Set width or height on the element
                        jQuery.style( elem, type, value, extra );
                }, type, chainable ? margin : undefined, chainable );
            };
        } );
    } );
    
    
    jQuery.fn.extend( {
    
        bind: function( types, data, fn ) {
            return this.on( types, null, data, fn );
        },
        unbind: function( types, fn ) {
            return this.off( types, null, fn );
        },
    
        delegate: function( selector, types, data, fn ) {
            return this.on( types, selector, data, fn );
        },
        undelegate: function( selector, types, fn ) {
    
            // ( namespace ) or ( selector, types [, fn] )
            return arguments.length === 1 ?
                this.off( selector, "**" ) :
                this.off( types, selector || "**", fn );
        }
    } );
    
    jQuery.parseJSON = JSON.parse;
    
    
    
    
    // Register as a named AMD module, since jQuery can be concatenated with other
    // files that may use define, but not via a proper concatenation script that
    // understands anonymous AMD modules. A named AMD is safest and most robust
    // way to register. Lowercase jquery is used because AMD module names are
    // derived from file names, and jQuery is normally delivered in a lowercase
    // file name. Do this after creating the global so that if an AMD module wants
    // to call noConflict to hide this version of jQuery, it will work.
    
    // Note that for maximum portability, libraries that are not jQuery should
    // declare themselves as anonymous modules, and avoid setting a global if an
    // AMD loader is present. jQuery is a special case. For more information, see
    // https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon
    
    if ( typeof define === "function" && define.amd ) {
        define( "jquery", [], function() {
            return jQuery;
        } );
    }
    
    
    
    
    var
    
        // Map over jQuery in case of overwrite
        _jQuery = window.jQuery,
    
        // Map over the $ in case of overwrite
        _$ = window.$;
    
    jQuery.noConflict = function( deep ) {
        if ( window.$ === jQuery ) {
            window.$ = _$;
        }
    
        if ( deep && window.jQuery === jQuery ) {
            window.jQuery = _jQuery;
        }
    
        return jQuery;
    };
    
    // Expose jQuery and $ identifiers, even in AMD
    // (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
    // and CommonJS for browser emulators (#13566)
    if ( !noGlobal ) {
        window.jQuery = window.$ = jQuery;
    }
    
    
    
    
    
    return jQuery;
    } );
    
    },{}]},{},[1])
    