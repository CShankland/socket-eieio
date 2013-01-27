// Simple tick test
var foo = [];
for (var i = 0; i < 1000; ++i) {
	foo.push(i);
}

while (foo.length) {
	foo.pop();
}

console.log("Done");
