function prettyJson(obj) {
    return JSON.stringify(obj, null, "  ");
}

function createZip() {
    let name = window.prompt("Save as...", "datapack");
    if (name != null) {
        let zip = new JSZip();
        zip.file("pack.mcmeta", prettyJson({
            pack: {
                pack_format: 6,
                description: "DF progression config, generated automatically"
            }
        }));
        let mmnmAbilities = zip.folder("data/mineminenomi/abilities");
        mmnmAbilities.file("example_ability.json", "not implemented");
        zip.generateAsync({type:"blob"})
            .then(function(content) {
                saveAs(content, name + ".zip");
        });
    }
}
