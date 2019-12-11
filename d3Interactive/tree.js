let dataTable = { nodes: [] };

// Load data
let rootNode = {};
let rootNodeName;
let treeData;

dataProcess().then(generateTree(treeData));

async function dataProcess() {
  d3.csv('../data/PetSupplies.csv', function (source) {

    convertChildren(rootNode, 0);

    function convertChildren(node, id) {
      node.id = id;
      node.name = source[id].name;
      node.productCount = parseInt(source[id].productCount);
      node.parent = node.id == 0 ? "null" : source[id].parent;
      if (source[id].children == "[]") {
        node.children = [];
        return node;
      } else {
        let arr = source[id].children.substring(1, source[id].children.length - 1).split(", ").map(Number);
        node.children = [];
        arr.forEach(childId => {
          let child = {};

          node.children.push(convertChildren(child, childId));
        });
        return node;
      }
    }


  });

  convertChildren(rootNode, 0);

  rootNode.name = source[0].name;

  treeData = [
    {
      "name": "Top Level",
      "parent": "null",
      "children": [
        {
          "name": "Level 2: A",
          "parent": "Top Level",
          "children": [
            {
              "name": "Son of A",
              "parent": "Level 2: A",
              "children": [
                {
                  "name": "granson of A",
                  "parent": "Son of A"
                }
              ]
            },
            {
              "name": "Daughter of A",
              "parent": "Level 2: A"
            }
          ]
        },
        {
          "name": "Level 2: B",
          "parent": "Top Level"
        }
      ]
    }
  ];

  // rootNode.children = rootNode._children;
  // rootNode._children = null;
  // rootNode.name = rootNode.name;


  treeData = [];
  treeData.push(rootNode);
}

  console.log(treeData[0]);

function generateTree(treeData) {
  // ************** Generate the tree diagram	 *****************
  let margin = { top: 20, right: 120, bottom: 20, left: 120 },
    width = 1200 - margin.right - margin.left,
    height = 500 - margin.top - margin.bottom;

  let i = 0,
    duration = 750,
    root;

  let tree = d3.layout.tree()
    .size([height, width]);

  let diagonal = d3.svg.diagonal()
    .projection(function (d) { return [d.y, d.x]; });

  let svg = d3.select("body").append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  root = treeData[0];
  // root._children = root.children;
  // root.children = null;
  console.log(root);
  root.x0 = height / 2;
  root.y0 = 0;

  update(root);


  d3.select(self.frameElement).style("height", "500px");


  function update(source) {

    // Compute the new tree layout.
    let nodes = tree.nodes(root).reverse();
      links = tree.links(nodes);

    // Compute the new tree layout.
    let nodes = tree.nodes(root).reverse();
    links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function (d) { d.y = d.depth * 180; });

    // Update the nodes…
    let node = svg.selectAll("g.node")
      .data(nodes, function (d) { return d.id || (d.id = ++i); })

    function altclick(d) {
      let children = d._children ? d._children : d.children;
      console.log("clicked")
      console.log(d)
      nodes.forEach(c => {
        // console.log(c == d)
        if (c != d) {
          if (c.children) {
            c._children = c.children;
            c.children = null;
          }
        }
      });
      d.children = children;
      d._children = null;

      let parent = d;
      while (parent.parent != "null") {

        parent = parent.parent;
        let sub = parent._children ? parent._children : parent.children;
        parent.children = sub;
        parent._children = null;
      }

      console.log(d)
      console.log(nodes)
      update(d);
    }

    // Enter any new nodes at the parent's previous position.
    let nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function (d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", altclick);

    nodeEnter.append("circle")
      .attr("r", 1e-6)
      .style("fill", function (d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeEnter.append("text")
      .attr("x", function (d) { return d.children || d._children ? -13 : 13; })
      .attr("dy", ".35em")
      .attr("text-anchor", function (d) { return d.children || d._children ? "end" : "start"; })
      .text(function (d) { return d.name; })
      .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    let nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });

    nodeUpdate.select("circle")
      .attr("r", 10)
      .style("fill", function (d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeUpdate.select("text")
      .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    let nodeExit = node.exit()
      // .duration(duration)
      .attr("transform", function (d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove();

    nodeExit.select("circle")
      .attr("r", 1e-6);

    nodeExit.select("text")
      .style("fill-opacity", 1e-6);

    // Update the links…
    let link = svg.selectAll("path.link")
      .data(links, function (d) { return d.target.id; });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", function (d) {
        let o = { x: source.x0, y: source.y0 };
        return diagonal({ source: o, target: o });
      });

    // Transition links to their new position.
    link.transition()
      .duration(duration)
      .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit()
      // .duration(duration)
      .attr("d", function (d) {
        let o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      })
      .remove();

    // Stash the old positions for transition.
    nodes.forEach(function (d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Toggle children on click.
  function click(d) {
    console.log(d);
    if (d.children) {
      d._children = d.children;
      d.children = null;
      console.log("if called");
    } else {
      d.children = d._children;
      d._children = null;
      console.log("else called");
    }
    // console.log(root)
    update(d);

  }
}

// ************** Generate the tree diagram	 *****************


