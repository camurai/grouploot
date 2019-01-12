var GroupLoot = GroupLoot || (function() {
    
    let lootbox;
    let handouttext;
    let player;
    let handouts = {};
    
    const init = () => {
        initLootBox();
        initHandout(lootbox);
        updateHandouts();
    };

    const msgHandler = (msg) => {
        if (msg.type == 'api' && getMessageCommand(msg) == 'grouploot') {
            player = getObj('player', msg.playerid);
            runAllCommands(msg);
        }
    }

    const getMessageCommand = (msg) => {
        return msg.content.substring(1,msg.content.indexOf(" "));;
    }

    const runAllCommands = (msg) => {
        let args = getMessageArgs(msg);
        let command = msg.content.substring(msg.content.indexOf(" ")+1);
        if(command.indexOf(" ") !== -1) {
            command = command.substring(0,command.indexOf(" "));
        }
        runCommand(command, args);
    }

    const runCommand = (command, args) => {
        switch(command) {
            case "takemoney":
                args = args.split(/ /g);
                transferCurrency(args[1], args[0], lootbox, getPlayerCharacter(player.id));    
                break;
            case "givemoney":
                args = args.split(/ /g);
                transferCurrency(args[1], args[0], getPlayerCharacter(player.id), lootbox);
                break;
            case "takeitem":
                transferItem(args, lootbox, getPlayerCharacter(player.id));    
                break;
            case "giveitem":
                let targetid = args.substring(0,args.indexOf(" "));
                let item = args.substring(args.indexOf(" ")+1);
                let targetChar = lootbox;

                if(targetid !== "all" && targetid !== "") {
                    targetChar = getPlayerCharacter(targetid);
                }
                
                log("giving item " + item + " to " + targetid);
                log("target character:"+targetChar)
                //transferItem(args, getPlayerCharacter(player.id), lootbox);
                transferItem(item,getPlayerCharacter(player.id), targetChar)
                break;
            case "update":
                updateHandouts();
                break;
            case "openCharHandout":
                msgPlayer("generating Character Handout")
                openCharHandout(getPlayerCharacter(player.id));
                break;
        }
        updateHandouts();
    }

    const transferCurrency = (coin, ammount, source, target) => {
        let sourceattr;
        let targetattr;

        if(!source) {
            msgPlayer("Transfer Failed: Source Missing")
            return;
        }
        if(!target) {
            msgPlayer("Transfer Failed: Target Missing")
            return;
        }

        if(coin != "gp" && coin != "sp" && coin != "cp" && coin != "pp") {
            msgPlayer("Transfer Failed: Not a valid coin type. use gp, sp, cp, or pp")
            return;
        }

        sourceattr = getAttr(coin, source.id);
        targetattr = getAttr(coin, target.id);


        if(!sourceattr) {
            msgPlayer("Transfer Failed: source has no " + coin)
            return;
        }

        if(sourceattr.get("current") >= parseInt(ammount)) {
            
            if(!targetattr){
                targetattr = createObj("attribute", {
                    name: coin,
                    current: 0,
                    characterid: target.id
                });
            }
            targetattr.set("current", parseInt(targetattr.get("current")) + parseInt(ammount));            
            sourceattr.set("current", parseInt(sourceattr.get("current")) - parseInt(ammount));
            msgPlayer("Transfer Complete: Moved " + ammount + coin + " from " + source.get("name") + " to " + target.get("name"));
        }
        else {
            msgPlayer("Transfer Failed: source only has " + sourceattr.get("current") + coin)
        }
    }

    const transferItem = (id, source, target) => {
        let item;
        let prefix;
        let items;
        let prop;

        if(!source) {
            msgPlayer("Transfer Failed: Source Missing")
            return;
        }
        if(!target) {
            msgPlayer("Transfer Failed: Target Missing")
            return;
        }

        items = getItems(source.id);

        for(prop in items) {

            if(items[prop]._itemname.get("current") === id) {
                item = items[prop];
                break;
            }
        }

        for(prop in item) {
            item[prop].set("_characterid", target.id);
            createObj("attribute", {
                name:item[prop].get("name"),
                _characterid:target.id,
                current:item[prop].get("current")
            })
            item[prop].remove();
        }

        msgPlayer("Transfer Complete: Moved " + item._itemname.get("current") + " from " + source.get("name") + " to " + target.get("name"));
 
    }

    const openCharHandout = (character) => {
        initHandout(character);
        updateHandout(character.id);
        //TODO: set visiblity for new handout for character player and pop it open
    }

    const getItems = (charid) => {
        let items = {};

        filterObjs(function(o) {
            let uid;
            let prop;

            if (o.get('_type') === 'attribute') {
                id = o.get('_characterid');
                name = o.get('name');

                if (id === charid && name.search('^repeating_inventory_(-[-A-Za-z0-9]+?|\\d+)_') !== -1) {
                    uid = name.substring(21);
                    prop = uid.substring(uid.indexOf("_"));
                    uid = uid.substring(0,uid.indexOf("_"));

                    if(!items[uid]) {
                        items[uid] = {}
                    }
                    items[uid][prop] = o;
                }
            }
        });
        return items;

    }

    const msgPlayer = (msg) => {
        let target = "";
        if(player) {
            target = '/w ' + player.get("displayname") + ' ';
        }
        sendChat("GroupLoot", target + msg , null, {noarchive:true});
    }
    const getPlayerCharacter = (playerid) =>{
        let character;
        let characters = findObjs({
            _type:"character",
            controlledby:playerid
        })

        if(characters) {
            if(characters.length === 1) {
                character = characters[0]                
            }
            else {

                //TODO: if more then one, ask user which character to use
                character = characters[0]                
            }
        }
        else {
            msgPlayer("Failed to get Player Character");
            //TODO: send message that no character was found
        }
        return character;
    }

    const getAttr = (name, id) => {
        if(!id) {
            id = lootbox.id;
        }
        return findObjs({
            _type:"attribute",
            _characterid: id,
            name: name
        })[0];
    }

    const getMessageArgs = (msg) => {
        let args = msg.content;
        args = args.substring(args.indexOf(" ")+1);

        if(args.indexOf(" ") === -1) {
            args = "";
        }
        else{
            args = args.substring(args.indexOf(" ")+1)
        }

        return args;
    }

    const initLootBox = () => {

        lootbox = findObjs({
                _type: "character",
                name: "Group"
        }, {caseInsensitive: true});

        if(lootbox.length <= 0) {
            // Create character object
            lootbox = createObj("character", {
                name: "Group"
            });
        }
        else {
            lootbox = lootbox[0];
        }
    };

    const initHandout = (character) => {
        let handoutPage;
        let id = character.id;
        let name = character.get("name");
        handoutPage = findObjs({
            _type:"handout",
            name: name + " Loot"
        }, {caseInsensitive: true});

        if(handoutPage.length <=0) {
            msgPlayer("Creating loot handout for " + name)
            handoutPage = createObj("handout", {
                name: name + " Loot"
            })
        }
        else {
            msgPlayer("Found loot handout for " + name)
            handoutPage = handoutPage[0];
        }
        if(character === lootbox){
            handoutPage.set("inplayerjournals", "all")
        }
        else {
            handoutPage.set("inplayerjournals", player.id);
        }
        handouts[id] = handoutPage;
    }

    const updateHandouts = () => {
        for(let prop in handouts) {
            updateHandout(prop);
        }
    }

    const updateHandout = (charid) => {
        handout = handouts[charid];
        handouttext = "<a href='`!grouploot update'>update</a></b>";

        updateCurrency(charid);
        updateItems(charid);
        handouttext = applyStyles(handouttext, styles);
        handouts[charid].set("notes", handouttext);
    };

    const updateCurrency = (charid) => {
        startTable("currency");
        handouttext += "<tr><td><span style='{header}'><b>Coin</b></span></td><td><b>Qty</b></td>";
        if(charid === lootbox.id) {
            handouttext += "<td><b>Take</b></td>";
        }
        handouttext += "<td><b>Contribute</b></td></tr>";
        addAttr("Platinum","pp", charid);
        addAttr("Gold","gp", charid);
        addAttr("Electrum","ep", charid);
        addAttr("Silver","sp", charid);
        addAttr("Copper","cp", charid);
        endTable();
    };

    const updateItems = (charid) => {
        startTable("items");
        handouttext += "<tr><td><b>Item</b></td><td><b>Qty</b></td><td><b>Description</b></td>";
        if(charid === lootbox.id){
            handouttext += "<td><b>Take</b></td>"
        }
        else {
            handouttext += "<td><b>Give</b></td>";
        }
        handouttext += "</tr>";
        let i = 0;
        let itemName = getAttrByName(charid, "repeating_inventory_$"+i+"_itemname");
        let itemCount = 0;
        let itemDesc = "";
        while(itemName !== "") {
            itemCount = getAttrByName(charid, "repeating_inventory_$"+i+"_itemcount");
            itemDesc = getAttrByName(charid, "repeating_inventory_$"+i+"_itemcontent");
            addItem(itemName, itemCount, itemDesc, charid);

            //get next itemname;
            i++;
            itemName = getAttrByName(charid, "repeating_inventory_$"+i+"_itemname");
        }
        endTable();
        if(charid === lootbox.id){
            handouttext +="<a href='`!grouploot openCharHandout'>Connect Personal Loot</a><br/>"
            for(let prop in handouts) {
                if(prop !== lootbox.id) {
                    handouttext += '<a href="http://journal.roll20.net/handout/' + handouts[prop].id + '">'+handouts[prop].get("name") + '</a><br/>';

                }
            }
        }
    };

    const startTable = (id) => {
        handouttext +='<table style="{table}" id="'+ id +'"><tbody></tbody>';
    };

    const endTable = () => {
        handouttext +="</tbody></table>";
    };

    const addAttr = (label, id, charid) => {
        let attrObj = findObjs({
            _type:"attribute",
            _characterid:charid,
            name:id
        })

        //let attr = getAttrByName(lootbox.id, id);
        if(attrObj.length >= 1) {
            attrObj = attrObj[0];
        }
        else{
            return;
        }

        if(attrObj.get("current") != "") {
            handouttext += "<tr><td><b>" + label + ":</b></td>" +
                "<td><div style='{coinbutton}{coincolor"+id+"}'>" + attrObj.get("current") + "</div></td>";
            if(charid === lootbox.id) {
                handouttext += "<td><a href='`!grouploot takemoney 1 " + id +"'><div style='{coinbutton}{coincolor"+id+"}'>1</div></a> ";
                handouttext += "<a href='`!grouploot takemoney 5 " + id +"'><div style='{coinbutton}{coincolor"+id+"}'>5</div></a>";
                handouttext += "<a href='`!grouploot takemoney 10 " + id +"'><div style='{coinbutton}{coincolor"+id+"}'>10</div></a> ";
                handouttext += "<a href='`!grouploot takemoney 50 " + id +"'><div style='{coinbutton}{coincolor"+id+"}'>50</div></a> ";
                handouttext += "<a href='`!grouploot takemoney 100 " + id +"'><div style='{coinbutton}{coincolor"+id+"}'>100</div></a></td>";
            }
            handouttext += "<td><a href='`!grouploot givemoney 1 "+ id + "'><div style='{coinbutton}{coincolor"+id+"}'>1</div></a> ";    
            handouttext += "<a href='`!grouploot givemoney 5 "+ id + "'><div style='{coinbutton}{coincolor"+id+"}'>5</div></a> ";    
            handouttext += "<a href='`!grouploot givemoney 10 "+ id + "'><div style='{coinbutton}{coincolor"+id+"}'>10</div></a> ";    
            handouttext += "<a href='`!grouploot givemoney 50 "+ id + "'><div style='{coinbutton}{coincolor"+id+"}'>50</div></a> ";    
            handouttext += "<a href='`!grouploot givemoney 100 "+ id + "'><div style='{coinbutton}{coincolor"+id+"}'>100</div></a></td></tr>";    
        }
    };

    const addItem = (name, count, desc, charid ) => {
        handouttext += "<tr><td>" + name + "</td>" + 
            "<td> " + count + "</td>" + 
            "<td>" + desc + "</td>";
        if(charid === lootbox.id) {
            handouttext += "<td><a href = '`!grouploot takeitem " + name + "'>Take</a></td>";
        }
        else {
            //handouttext += "<td><a href = '`!grouploot giveitem " + name + "'>Group</a></td>";
            for(let i in handouts) {
                
                handouttext += "<td><a href = '`!grouploot giveitem " + handouts[i].get("inplayerjournals") + " " + name + "'>" + handouts[i].get("name").replace(" Loot","") + "</a></td>";
            }
        }
        handouttext += "</tr>";
    };


    ////Styling code
    const styles = {
        coinbutton: "border-radius:20px;"+ 
            "display:inline-block;" +
            "color:#000000;"+
            "margin:2px;"+
            "padding:5px;"+
            "width:20px;"+
            "height:20px;"+
            "text-align:center;",
        coincolorpp:"background-color:#e5e4e2;",
        coincolorgp:"background-color:#d9a760;",
        coincolorsp:"background-color:#C0C0C0;",
        coincolorep:"background-color:#e7c697;",
        coincolorcp:"background-color:#b87333;"
    }
    const applyStyles = (text, styles) => {
        let replaceregexp;
        for(let style in styles) {
            replaceregexp = new RegExp("{" + style + "}", "g");
            text = text.replace(replaceregexp, styles[style]);
        }
        return text;
    }
    //

    return {
        init: init,
        msgHandler:msgHandler,
        update:updateHandouts
    };
})();

on('ready', function() {
    GroupLoot.init();
});

on('chat:message', (msg) => {
    GroupLoot.msgHandler(msg);
});

on('change:attribute', function (){
    GroupLoot.update();
})