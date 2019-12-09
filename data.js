

var nodeTable = { nodes: [] };
var linkTable = { links: [] };
var nodeData;
var linkData;

d3.csv('./data/PetSupplies.csv', function (data) {

    for (var i = 0; i < data.length; i++) {
        nodeTable.nodes.push({ name: data[i].name, group: parseInt(data[i].parent), size: parseInt(Math.sqrt(data[i].productCount)) });
        linkTable.links.push({ source: parseInt(data[i].id), target: parseInt(data[i].parent), value: 1 });
    }


    nodeData = JSON.stringify(nodeTable);
    linkData = JSON.stringify(linkTable);
    console.log(nodeData);
});


