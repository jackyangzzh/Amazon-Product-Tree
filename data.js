

var nodeTable = { nodes: [] };
var linkTable = { links: [] };
var table = { nodes: [], links: [] };
var nodeData;
var linkData;
var tableData;

d3.csv('./data/PetSupplies.csv', function (data) {

    for (var i = 0; i < data.length; i++) {
        table.nodes.push({ name: data[i].name, group: parseInt(data[i].parent), size: parseInt(Math.sqrt(data[i].productCount)) });
        table.links.push({ source: parseInt(data[i].id), target: parseInt(data[i].parent), value: 1 });
    }


    tableData = JSON.stringify(table);
    console.log(tableData);
});


