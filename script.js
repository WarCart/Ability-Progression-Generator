function prettyJson(obj) {
    return JSON.stringify(obj, null, "  ");
}

// --- Config loading ---

let configs = [];
let subRacePrefixMap = {}; // subrace name -> bool (should prefix with modId)

function loadConfigs() {
    fetch("configs/index.json")
        .then(function(res) { return res.json(); })
        .then(function(fileNames) {
            let promises = fileNames.map(function(fileName) {
                return fetch("configs/" + fileName)
                    .then(function(res) { return res.json(); })
                    .then(function(data) {
                        let configName = fileName.replace(/\.json$/, "");
                        configs.push({
                            name: configName,
                            modId: data.modId,
                            abilities: data.abilities || [],
                            races: data.races || [],
                            factions: data.factions || [],
                            fightingStyles: data.fightingStyles || [],
                            devilFruits: data.devilFruits || []
                        });
                    });
            });
            return Promise.all(promises);
        })
        .then(function() {
            // Populate simple datalists
            let lists = {
                abilityNames: "abilities",
                factionNames: "factions",
                fightingStyleNames: "fightingStyles",
                devilFruitNames: "devilFruits"
            };
            for (let listId in lists) {
                let datalist = document.getElementById(listId);
                for (let config of configs) {
                    for (let item of config[lists[listId]]) {
                        let opt = document.createElement("option");
                        opt.value = item;
                        datalist.appendChild(opt);
                    }
                }
            }
            // Populate race and subrace datalists
            let raceList = document.getElementById("raceNames");
            let subRaceList = document.getElementById("subRaceNames");
            for (let config of configs) {
                for (let race of config.races) {
                    if (typeof race === "string") {
                        let opt = document.createElement("option");
                        opt.value = race;
                        raceList.appendChild(opt);
                    } else {
                        let opt = document.createElement("option");
                        opt.value = race.name;
                        raceList.appendChild(opt);
                        let prefix = race.prefixSubRaces !== false;
                        for (let sub of (race.subraces || [])) {
                            let subOpt = document.createElement("option");
                            subOpt.value = sub;
                            subRaceList.appendChild(subOpt);
                            subRacePrefixMap[sub] = prefix;
                        }
                    }
                }
            }
            // Update any existing dir selects
            for (let select of document.querySelectorAll(".dir-select")) {
                updateDirSelect(select);
            }
            document.getElementById("configStatus").textContent = configs.length + " config(s) loaded";
        })
        .catch(function(err) {
            console.error("Failed to load configs:", err);
            document.getElementById("configStatus").textContent = "Failed to load configs (are you using a local server?)";
        });
}

function updateDirSelect(select) {
    let current = select.value;
    select.innerHTML = "";
    for (let config of configs) {
        let opt = document.createElement("option");
        opt.value = config.modId;
        opt.textContent = config.name + " (" + config.modId + ")";
        select.appendChild(opt);
    }
    if (current) select.value = current;
}

// --- Requirement type definitions ---

const REQ_TYPES = {
    "ability_progression:doriki": {
        label: "Doriki",
        args: [
            { key: "doriki", label: "Doriki", type: "number" },
            { key: "percentage", label: "Percentage", type: "checkbox" }
        ]
    },
    "ability_progression:haki": {
        label: "Haki",
        args: [
            { key: "hakiXP", label: "Haki XP", type: "number" },
            { key: "hakiType", label: "Haki Type", type: "select", options: ["BUSOSHOKU", "KENBUNSHOKU", "HAOSHOKU"] },
            { key: "percentage", label: "Percentage", type: "checkbox" }
        ]
    },
    "ability_progression:race": {
        label: "Race",
        args: [{ key: "race", label: "Race", type: "text", listId: "raceNames", prefixModId: true }]
    },
    "ability_progression:sub_race": {
        label: "Sub Race",
        args: [{ key: "subRace", label: "Sub Race", type: "text", listId: "subRaceNames", prefixSubRace: true }]
    },
    "ability_progression:fighting_style": {
        label: "Fighting Style",
        args: [{ key: "style", label: "Style", type: "text", listId: "fightingStyleNames", prefixModId: true }]
    },
    "ability_progression:faction": {
        label: "Faction",
        args: [{ key: "faction", label: "Faction", type: "text", listId: "factionNames", prefixModId: true }]
    },
    "ability_progression:devil_fruit": {
        label: "Devil Fruit",
        args: [{ key: "fruitID", label: "Fruit ID", type: "text", listId: "devilFruitNames", prefixModId: true }]
    },
    "ability_progression:awakening": {
        label: "Awakening",
        args: []
    },
    "ability_progression:quest": {
        label: "Quest",
        args: [{ key: "questID", label: "Quest ID", type: "text", prefixModId: true }]
    },
    "ability_progression:haoshoku_born": {
        label: "Haoshoku Born",
        args: []
    },
    "ability_progression:unlocked_ability": {
        label: "Unlocked Ability",
        args: [{ key: "ability", label: "Ability", type: "text", prefixModId: true }]
    },
    "ability_progression:default": {
        label: "Default",
        args: []
    },
    "ability_progression:loyalty": {
        label: "Loyalty",
        args: [{ key: "loyalty", label: "Loyalty", type: "number" }]
    },
    "ability_progression:ability_used": {
        label: "Ability Used",
        args: [
            { key: "abilityID", label: "Ability ID", type: "text", prefixModId: true },
            { key: "timesUsed", label: "Times Used", type: "number" }
        ]
    }
};

const MODIFIER_TYPES = [
    "mineminenomi:cooldown",
    "mineminenomi:damage",
    "mineminenomi:charge",
    "mineminenomi:heal",
    "mineminenomi:range",
    "mineminenomi:projectile",
    "mineminenomi:continuous"
];

// --- UI functions ---

function addAbility() {
    let container = document.getElementById("abilities");
    let card = document.createElement("div");
    card.className = "ability-card";
    card.innerHTML =
        '<div>' +
            '<label>Ability name: </label>' +
            '<input type="text" class="ability-name" list="abilityNames" placeholder="e.g. gomu_gomu_no_pistol">' +
            ' <label>Directory: </label>' +
            '<select class="dir-select"></select>' +
            ' <button class="remove" onclick="this.closest(\'.ability-card\').remove()">Remove Ability</button>' +
        '</div>' +
        '<div class="req-groups"><strong>Requirements</strong> (each group is OR, requirements within a group are AND)</div>' +
        '<button onclick="addRequirementGroup(this.parentElement)">Add Requirement Group</button>' +
        '<div class="modifiers"><strong>Modifiers</strong></div>' +
        '<button onclick="addModifier(this.parentElement)">Add Modifier</button>';
    container.appendChild(card);

    updateDirSelect(card.querySelector(".dir-select"));
}

function addRequirementGroup(abilityCard) {
    let groupsContainer = abilityCard.querySelector(".req-groups");
    let group = document.createElement("div");
    group.className = "req-group";
    group.innerHTML =
        '<em>Requirement Group (AND)</em>' +
        ' <button class="remove" onclick="this.closest(\'.req-group\').remove()">Remove Group</button>' +
        '<div class="req-list"></div>' +
        '<button onclick="addRequirement(this.parentElement)">Add Requirement</button>';
    groupsContainer.appendChild(group);
}

function addRequirement(groupEl) {
    let list = groupEl.querySelector(".req-list");
    let row = document.createElement("div");
    row.className = "req-row";

    let select = document.createElement("select");
    select.className = "req-type";
    select.onchange = function() { onRequirementTypeChange(this); };

    let defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "-- Select type --";
    select.appendChild(defaultOpt);

    for (let key in REQ_TYPES) {
        let opt = document.createElement("option");
        opt.value = key;
        opt.textContent = REQ_TYPES[key].label;
        select.appendChild(opt);
    }

    row.appendChild(select);

    let argsSpan = document.createElement("span");
    argsSpan.className = "req-args";
    row.appendChild(argsSpan);

    let removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = function() { row.remove(); };
    row.appendChild(removeBtn);

    list.appendChild(row);
}

function onRequirementTypeChange(selectEl) {
    let row = selectEl.closest(".req-row");
    let argsSpan = row.querySelector(".req-args");
    argsSpan.innerHTML = "";

    let typeDef = REQ_TYPES[selectEl.value];
    if (!typeDef) return;

    for (let arg of typeDef.args) {
        let label = document.createElement("label");
        label.textContent = " " + arg.label + ": ";
        argsSpan.appendChild(label);

        if (arg.type === "select") {
            let sel = document.createElement("select");
            sel.dataset.argKey = arg.key;
            for (let optVal of arg.options) {
                let opt = document.createElement("option");
                opt.value = optVal;
                opt.textContent = optVal;
                sel.appendChild(opt);
            }
            argsSpan.appendChild(sel);
        } else if (arg.type === "checkbox") {
            let cb = document.createElement("input");
            cb.type = "checkbox";
            cb.dataset.argKey = arg.key;
            argsSpan.appendChild(cb);
        } else if (arg.type === "number") {
            let inp = document.createElement("input");
            inp.type = "number";
            inp.dataset.argKey = arg.key;
            inp.style.width = "80px";
            argsSpan.appendChild(inp);
        } else {
            let inp = document.createElement("input");
            inp.type = "text";
            inp.dataset.argKey = arg.key;
            if (arg.listId) inp.setAttribute("list", arg.listId);
            if (arg.prefixModId) inp.dataset.prefixModId = "true";
            if (arg.prefixSubRace) inp.dataset.prefixSubRace = "true";
            argsSpan.appendChild(inp);
        }
    }
}

function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        let r = Math.random() * 16 | 0;
        let v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function addModifier(abilityCard) {
    let modContainer = abilityCard.querySelector(".modifiers");
    let row = document.createElement("div");
    row.className = "mod-row";
    row.innerHTML =
        '<label>UUID: </label><input type="text" class="mod-uuid" style="width:280px" value="' + generateUUID() + '">' +
        ' <label>Stat: </label>' +
        '<select class="mod-stat">' +
            MODIFIER_TYPES.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") +
        '</select>' +
        ' <label>Name: </label><input type="text" class="mod-name" placeholder="bonus_name">' +
        ' <label>Operation: </label>' +
        '<select class="mod-op"><option value="ADDITION">ADDITION</option><option value="MULTIPLICATION">MULTIPLICATION</option></select>' +
        ' <label>Value: </label><input type="number" class="mod-value" step="any" style="width:80px">' +
        ' <button class="remove" onclick="this.closest(\'.mod-row\').remove()">Remove</button>';
    modContainer.appendChild(row);
}

// --- Data gathering ---

function gatherAbilities() {
    let abilities = [];
    let cards = document.querySelectorAll(".ability-card");

    for (let card of cards) {
        let name = card.querySelector(".ability-name").value.trim();
        let modId = card.querySelector(".dir-select").value;

        if (!name) continue;

        // Gather requirements (2D array)
        let requirements = [];
        let groups = card.querySelectorAll(".req-group");
        for (let group of groups) {
            let andGroup = [];
            let rows = group.querySelectorAll(".req-row");
            for (let row of rows) {
                let typeSelect = row.querySelector(".req-type");
                if (!typeSelect.value) continue;

                let req = { name: typeSelect.value, args: {} };
                let argInputs = row.querySelectorAll("[data-arg-key]");
                for (let inp of argInputs) {
                    let key = inp.dataset.argKey;
                    if (inp.type === "checkbox") {
                        req.args[key] = inp.checked;
                    } else if (inp.type === "number") {
                        req.args[key] = inp.value;
                    } else {
                        let val = inp.value;
                        if (inp.dataset.prefixModId && val) {
                            val = modId + ":" + val;
                        } else if (inp.dataset.prefixSubRace && val && subRacePrefixMap[val]) {
                            val = modId + ":" + val;
                        }
                        req.args[key] = val;
                    }
                }
                andGroup.push(req);
            }
            if (andGroup.length > 0) {
                requirements.push(andGroup);
            }
        }

        // Gather modifiers
        let modifiers = {};
        let modRows = card.querySelectorAll(".mod-row");
        for (let row of modRows) {
            let stat = row.querySelector(".mod-stat").value;
            let modName = row.querySelector(".mod-name").value.trim();
            let op = row.querySelector(".mod-op").value;
            let value = parseFloat(row.querySelector(".mod-value").value) || 0;
            let uuid = row.querySelector(".mod-uuid").value.trim();

            if (!modifiers[stat]) {
                modifiers[stat] = [{}];
            }
            modifiers[stat][0][uuid] = {
                name: modName,
                type: op,
                value: value
            };
        }

        let abilityData = {};
        if (requirements.length > 0) {
            abilityData.requirements = requirements;
        }
        if (Object.keys(modifiers).length > 0) {
            abilityData.modifiers = modifiers;
        }

        abilities.push({ name: name, modId: modId, data: abilityData });
    }

    return abilities;
}

// --- Zip creation ---

function createZip() {
    let abilities = gatherAbilities();
    if (abilities.length === 0) {
        alert("No abilities to export.");
        return;
    }

    let name = window.prompt("Save as...", "datapack");
    if (name == null) return;

    let zip = new JSZip();
    zip.file("pack.mcmeta", prettyJson({
        pack: {
            pack_format: 6,
            description: "DF progression config, generated automatically"
        }
    }));

    for (let ability of abilities) {
        let folder = zip.folder("data/" + ability.modId + "/abilities");
        folder.file(ability.name + ".json", prettyJson(ability.data));
    }

    zip.generateAsync({ type: "blob" }).then(function(content) {
        saveAs(content, name + ".zip");
    });
}
