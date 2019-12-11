

hljs.initHighlightingOnLoad();
        var width = 2000,
            height = 1000;

        var color = d3.scaleOrdinal(d3.schemeCategory20);

        var cola = cola.d3adaptor(d3)
            .size([width, height]);

        var svg = d3.select("body").append("svg")
            .attr("width", width)
            .attr("height", height);

        d3.json("test.json", function (error, graph) {
            var groupMap = {};
            graph.nodes.forEach(function (v, i) {
                var g = v.group;
                if (typeof groupMap[g] == 'undefined') {
                    groupMap[g] = [];
                }
                groupMap[g].push(i);

                v.width = v.height = 10;
            });

            var groups = [];
            for (var g in groupMap) {
                groups.push({ id: g, leaves: groupMap[g] });
            }
            cola
                .nodes(graph.nodes)
                .links(graph.links)
                .groups(groups)
                .jaccardLinkLengths(40, 0.7)
                .avoidOverlaps(true)
                .start(50, 0, 50);

            var group = svg.selectAll('.group')
                .data(groups)
                .enter().append('rect')
                .classed('group', true)
                .attr('rx', 5)
                .attr('ry', 5)
                .style("fill", function (d) { return color(d.id); })
                .call(cola.drag);

            var link = svg.selectAll(".link")
                .data(graph.links)
                .enter().append("line")
                .attr("class", "link")
                .style("stroke-width", function (d) { return Math.sqrt(d.value); });

            var node = svg.selectAll(".node")
                .data(graph.nodes)
                .enter().append("circle")
                .attr("class", "node")
                .attr("r", function(d) {return Math.sqrt(d.size) + 5;})
                .style("fill", function (d) { return color(d.group); })
                .call(cola.drag);

            node.append("title")
                .text(function (d) { return d.name; });

            cola.on('tick', function () {
                link.attr("x1", function (d) { return d.source.x; })
                    .attr("y1", function (d) { return d.source.y; })
                    .attr("x2", function (d) { return d.target.x; })
                    .attr("y2", function (d) { return d.target.y; });

                node.attr("cx", function (d) { return d.x; })
                    .attr("cy", function (d) { return d.y; });

                group
                    .attr('x', function (d) { return d.bounds.x })
                    .attr('y', function (d) { return d.bounds.y })
                    .attr('width', function (d) { return d.bounds.width() })
                    .attr('height', function (d) { return d.bounds.height() });
            });
        });
