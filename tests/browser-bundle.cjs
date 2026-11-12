const fs=require('node:fs');
let html=fs.readFileSync('index.html','utf8');
html=html.replace(/<link rel="stylesheet" href="src\/style.css">/,()=>'<style>'+fs.readFileSync('src/style.css','utf8')+'</style>');
for(const file of ['physics','race','planning','main'])html=html.replace(`<script src="src/${file}.js"></script>`,()=>'<script>'+fs.readFileSync(`src/${file}.js`,'utf8')+'</script>');
process.stdout.write(JSON.stringify(html));
