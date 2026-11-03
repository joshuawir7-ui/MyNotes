const fs = require("fs");
const path = require("path");

const htmlPath = path.join(".next", "analyze", "client.html");
const html = fs.readFileSync(htmlPath, "utf8");

const startIdx = html.indexOf("chartData = [");
const endIdx = html.indexOf(";\n", startIdx);
const jsonStr = html.slice(startIdx + "chartData = ".length, endIdx > -1 ? endIdx : html.indexOf(";</script>", startIdx));
const data = JSON.parse(jsonStr);

const modules = [];

function walk(node, curPath) {
  const p = curPath ? curPath + "/" + (node.label || "") : (node.label || "");
  if (node.groups && node.groups.length > 0) {
    node.groups.forEach(g => walk(g, p));
  } else {
    modules.push({
      path: p,
      name: node.label,
      parsed: node.parsedSize || 0,
      stat: node.statSize || 0,
      gzip: node.gzipSize || 0
    });
  }
}

data.forEach(chunk => walk(chunk, ""));

modules.sort((a, b) => b.parsed - a.parsed);

console.log("=== TOP 25 MODULES BY PARSED SIZE ===");
const topModules = modules.slice(0, 25).map(m => ({
  module: m.name,
  path: m.path.length > 60 ? "..." + m.path.slice(-57) : m.path,
  parsedKB: +(m.parsed / 1024).toFixed(1),
  statKB: +(m.stat / 1024).toFixed(1),
  gzipKB: +(m.gzip / 1024).toFixed(1)
}));
console.table(topModules);

// Now let's group by package/source folder:
const packages = {};
modules.forEach(m => {
  let pkg = "other";
  if (m.path.includes("node_modules")) {
    const parts = m.path.split("node_modules/");
    const rest = parts[parts.length - 1];
    pkg = rest.startsWith("@") ? rest.split("/").slice(0, 2).join("/") : rest.split("/")[0];
  } else if (m.path.includes("src/")) {
    const parts = m.path.split("src/");
    pkg = "src/" + parts[parts.length - 1].split("/").slice(0, 2).join("/");
  }
  if (!packages[pkg]) packages[pkg] = { parsed: 0, stat: 0, gzip: 0 };
  packages[pkg].parsed += m.parsed;
  packages[pkg].stat += m.stat;
  packages[pkg].gzip += m.gzip;
});

const topPkgs = Object.entries(packages)
  .map(([k, v]) => ({
    package: k,
    parsedKB: +(v.parsed / 1024).toFixed(1),
    statKB: +(v.stat / 1024).toFixed(1),
    gzipKB: +(v.gzip / 1024).toFixed(1)
  }))
  .sort((a, b) => b.parsedKB - a.parsedKB);

console.log("\n=== TOP 20 LIBRARIES / FOLDERS ===");
console.table(topPkgs.slice(0, 20));
