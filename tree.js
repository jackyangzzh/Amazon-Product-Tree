var width = 1160,
    height = 900;

var d3cola = cola.d3adaptor()
    .avoidOverlaps(true)
    .size([width, height]);

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

var nodeRadius = 5;

nodeSettings = {
    emperor: { number: 1, color: "#005a32", size: 15 },
    governor: { number: 0, color: "#e5f5e0", size: 10 },
    hierarchical3: { number: 0, color: "#c7e9c0", size: 8 },
    hierarchical4: { number: 0, color: "#a1d99b", size: 6 },
    hierarchical5: { number: 0, color: "#74c476", size: 4 },
    hierarchical6: { number: 0, color: "#41ab5d", size: 2 },
    outsiderA: { number: 0, color: "#99AD99", size: 8 },
    outsiderB: { number: 2, color: "#9BB3A7", size: 4 }
}

graph = graphConstructor();

graph.nodes.forEach(function (v) {
    v.height = 8 * nodeSettings[v.type].size;
    v.width = 2 * nodeSettings[v.type].size;
});

d3cola
    .nodes(graph.nodes)
    .links(graph.links)
    .flowLayout("y", 30)
    .symmetricDiffLinkLengths(25)
    .start(10, 40, 80);

// define arrow markers for graph links
svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)
    .attr('markerWidth', 3)
    .attr('markerHeight', 3)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#000');

var path = svg.selectAll(".link")
    .data(graph.links)
    .enter().append('svg:path')
    .attr('class', 'link');

var node = svg.selectAll(".node")
    .data(graph.nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", function (d) { return nodeSettings[d.type].size })
    .style("fill", function (d) { return nodeSettings[d.type].color; })
    .call(d3cola.drag);

node.append("title")
    .text(function (d) { return d.name; });

d3cola.on("tick", function () {
    path.attr('d', function (d) {
        var deltaX = d.target.x - d.source.x,
            deltaY = d.target.y - d.source.y,
            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
            normX = deltaX / dist,
            normY = deltaY / dist,
            sourcePadding = nodeSettings[d.source.type].size,
            targetPadding = nodeSettings[d.target.type].size + 2,
            sourceX = d.source.x + (sourcePadding * normX),
            sourceY = d.source.y + (sourcePadding * normY),
            targetX = d.target.x - (targetPadding * normX),
            targetY = d.target.y - (targetPadding * normY);
        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
    });

    node.attr("cx", function (d) { return d.x; })
        .attr("cy", function (d) { return d.y; });
});


function graphConstructor() {
    var nodes = [], links = [];


    var verticalEdgeSettings =
        [
            { source: "governor", target: "emperor", number: 6, numbermin: 4 },
            { source: "hierarchical3", target: "governor", number: 3, numbermin: 2 },
            { source: "hierarchical4", target: "hierarchical3", number: 3, numbermin: 1 },
            { source: "hierarchical5", target: "hierarchical4", number: 3, numbermin: 1 },
            { source: "hierarchical6", target: "hierarchical5", number: 5, numbermin: 0 },
            { source: "outsiderA", target: "emperor", number: 2, numbermin: 2 }
        ]

    var horizontalEdgeSettings =
        [
            { source: "governor", target: "governor", probability: .01 },
            { source: "hierarchical3", target: "hierarchical3", probability: .05 },
            { source: "hierarchical4", target: "hierarchical4", probability: .025 },
            { source: "hierarchical5", target: "hierarchical5", probability: .01 },
            { source: "outsiderA", target: "emperor", probability: .1 },
            { source: "outsiderA", target: "governor", probability: .25 },
            { source: "outsiderB", target: "governor", probability: .1 },
            { source: "outsiderB", target: "hierarchical3", probability: .2 }
        ]

    for (nodeClass in nodeSettings) {
        var x = 1;
        while (x <= nodeSettings[nodeClass].number) {
            var topNode = { label: nodeClass + "-" + x, type: nodeClass }
            nodes.push(topNode);
            x++;
        }
    }
    var node = 0;
    while (node < nodes.length && node < 500) {
        for (verticalEdge in verticalEdgeSettings) {
            if (nodes[node].type == verticalEdgeSettings[verticalEdge].target) {
                var x = 1;
                var x = Math.min(verticalEdgeSettings[verticalEdge].number - verticalEdgeSettings[verticalEdge].numbermin, Math.ceil(verticalEdgeSettings[verticalEdge].number * Math.random()))
                while (x < verticalEdgeSettings[verticalEdge].number) {
                    var spawnNode = { label: verticalEdgeSettings[verticalEdge].source + "-" + x, type: verticalEdgeSettings[verticalEdge].source }
                    nodes.push(spawnNode);
                    var newLink = { source: nodes[node], target: spawnNode, weight: 2, type: "vertical" };
                    links.push(newLink);

                    x++;
                }
            }
        }
        node++;
    }

    for (nodex in nodes) {
        for (nodey in nodes) {
            for (horizontalEdge in horizontalEdgeSettings) {
                if (horizontalEdgeSettings[horizontalEdge].source == nodes[nodex].type && horizontalEdgeSettings[horizontalEdge].target == nodes[nodey].type) {
                    var randomChance = Math.random();
                    if (randomChance < horizontalEdgeSettings[horizontalEdge].probability) {
                        var newLink = { source: nodes[nodex], target: nodes[nodey], weight: 1, type: "horizontal" };
                        links.push(newLink);
                    }
                }
            }
        }
    }
    genNodes = nodes;
    genEdges = links;
    var returnObject = { links: genEdges, nodes: genNodes };
    return returnObject;

}