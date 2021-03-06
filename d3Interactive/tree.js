
// let nodeTable = { nodes: [] };
// let linkTable = { links: [] };
// let table = { nodes: [], links: [] };
// let nodeData;
// let linkData;
// let tableData;
let rScale = 3;

let dataTable = { nodes: [] };

// Load data
let rootNode = {};
let treeData;

d3.csv('../data/all-nodes.csv', function (source) {

  /**
   * 
   * Caculate depth (reversed, with root of largest depth)
   */
  let nodeDepth;
  let max = 0;
  let min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < source.length; i++) {
    let temp = parseInt(source[i].subtreeProductCount);
    if (temp > max) {
      max = temp;
    }
    if (temp < min) {
      min = temp;
    }
  }
  console.log(max);
  console.log(min);


  convertChildren(rootNode, 0);

  function convertChildren(node, id, nodeDepth) {

    node.id = id;
    node.childrenCount = 0;
    node.name = source[id].name;
    node.nodeDepth = node.id == 0 ? nodeDepth = 1 : nodeDepth;
    node.productCount = parseInt(source[id].productCount);
    node.subtreeProductCount = parseInt(source[id].subtreeProductCount);
    node.normalizedValue = (node.subtreeProductCount - min) / (max - min);
    node.numChildren = parseInt(source[id].numChildren);
    node.parent = node.id == 0 ? "null" : source[id].parent;
    if (source[id].children == "[]") {
      node.children = [];
      return node;
    } else {
      let arr = source[id].children.substring(1, source[id].children.length - 1).split(", ").map(Number);
      node.children = [];
      arr.forEach(childId => {
        let child = {};
        node.children.push(convertChildren(child, childId, nodeDepth + 1));
      });
      return node;
    }
  }
  // childCalc(rootNode)


  generateTree(treeData);
});

// function childCalc(node){
//   let children = node.children;
//   // let children = "[]";
//   // children = node.children ? node.children : children;
//   // children = node._children ? node._children : children;

//   if (children == "") {
//     return 0;
//   }else{
//     children.forEach((c) => {
//       node.childrenCount = node.numChildren + childCalc(c);
//     })
//   }
//   console.log(node.childrenCount);
//   return node.childrenCount;
// }

treeData = [];
treeData.push(rootNode);



function generateTree(treeData) {

  // ************** Generate the tree diagram	 *****************
  let margin = { top: 20, right: 120, bottom: 20, left: 120 },
    width = 1500 - margin.right - margin.left,
    height = 2000 - margin.top - margin.bottom;

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
  // console.log(root);
  root.x0 = height / 2;
  root.y0 = 0;

  update(root);


  d3.select(self.frameElement).style("height", "500px");


  function update(source) {
    console.log(source)

    // Compute the new tree layout.
    let nodes = tree.nodes(root).reverse();
    links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function (d) { d.y = d.depth * 270; });

    // Update the nodes…
    let node = svg.selectAll("g.node")
      .data(nodes, function (d) { return d.id; })

    function altclick(d) {
      console.log("Clicked");
      let children = d._children ? d._children : d.children;
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

      // console.log(parent);
      while (parent.parent != "null") {

        parent = parent.parent;
        let sub = parent._children ? parent._children : parent.children;
        parent.children = sub;
        parent._children = null;
      }
      update(d);
    }

    // Enter any new nodes at the parent's previous position.
    let nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function (d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", altclick);

    nodeEnter.append("circle")
      .attr("r", 1e-6)
      .style("fill", function (d) {
        console.log(d)
        return d._children ? `hsl(214, 41, 70)` : "#fff";
      });

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
      .attr("r", function (d) { return d.normalizedValue * rScale + 10; })
      .style("fill", function (d) {
        // console.log(d.numChildren * 2)
        return d._children ? `hsl(214, 41, ${d.numChildren * 2})` : "#fff";
      });

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
    ;
    // Buttons
    function collapse() {

      nodes.forEach(n => {
        let children = n.children ? n.children : n._children;
        n._children = children;
        n.children = null;
      });
      update(root);

    }
    d3.select('#collapse').on("click", collapse);

    function expand() {
      nodes.forEach(n => {
        let children = n.children ? n.children : n._children;
        n.children = children;
        n._children = null;
        update(n);
      });
    }
    d3.select('#expand').on('click', expand);

  }



  // Toggle children on click.
  function click(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    update(d);

  }
}
