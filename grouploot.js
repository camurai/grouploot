var GroupLoot = GroupLoot || (function() {
    
    let group;
    let handouttext;
    let player;
    let handouts = {};
    let debugmode = false;
    
    /**
     * Initiate the script
     */
    const init = () => {
        if(!state.grouploot) {
            state.grouploot = {characters:[], stores:[]};
        }

        if(state.groupid) {
            group = getCharacterById(state.groupid);
        }
        if(group) {
            initHandout(group);
            updateHandouts();
        }
    };

    const getCharacterById = (id) => {

        return getCharacter({
            _type: "character",
            _id: id
        });
    }

    const getCharacterByName = (name) => {
        return getCharacter({
            _type: "character",
            name: name
        });
    }

    const getCharacter = (obj) => {
        let char = findObjs(obj);

        if(char.length > 0) {
            char = char[0];
        }

        return char;
    }

///// Chat Commands /////////

    /**
     * handles messaged in the roll20 chat
     * @param {string} msg 
     */
    const msgHandler = (msg) => {
        if (msg.type == 'api' && getMessageCommand(msg) == 'grouploot') {
            player = getObj('player', msg.playerid);
            runAllCommands(msg);
        }
    }

    /**
     * pulls the messgae command out of the message text
     * @param {string} msg 
     */
    const getMessageCommand = (msg) => {
        return msg.content.substring(1,msg.content.indexOf(" "));;
    }

    /**
     * runs the command from the message
     * @param {string} msg 
     */
    const runAllCommands = (msg) => {
        let args = getMessageArgs(msg);
        let command = msg.content.substring(msg.content.indexOf(" ")+1);
        if(command.indexOf(" ") !== -1) {
            command = command.substring(0,command.indexOf(" "));
        }
        runCommand(command, args);
    }

    /**
     * pulls the arguments out of the command text
     * @param {string} msg 
     */
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

    /**
     * runs the commands from the message
     * @param {string} command 
     * @param {string} args 
     */
    const runCommand = (command, args) => {
        switch(command) {
            case "takemoney":
                args = args.split(/ /g);
                transferCurrency(args[1], args[0], group.get("name"), getPlayerCharacter(player.id).get("name"));    
                break;

            case "givemoney":
                args = args.split(/ /g);
                transferCurrency(args[1], args[0], getPlayerCharacter(player.id).get("name"), group.get("name"));
                break;

            case "transfermoney":
                args = args.split("|");
                transferCurrency(args[1],args[0],args[2],args[3]);
                //!grouploot transfermoney 5|gp|Source Name|Target Name
                break;

            case "takeitem":
                transferItem(args, group.get("name"), getPlayerCharacter(player.id).get("name"));    
                break;

            case "giveitem":
            case "transferitem":
                args = args.split("|");
                transferItem(args[0],args[1], args[2])
                break;

            case "update":
                updateHandouts();
                break;

            case "linkCharHandout":
                linkCharHandout(getPlayerCharacter(player.id));
                break;

            case "addCharacter":
                addCharacter(args);
                break;

            case "setGroup":
                setGroup(args);
                break;
        }
        updateHandouts();
    }

    /**
     * gets the player character sheet in roll20 from the player id.
     * @param {string} playerid 
     */
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
        return character;
    }

    /**
     * sends a message to the player
     * @param {string} msg 
     */
    const msgPlayer = (msg) => {
        let target = "";
        if(player) {
            target = '/w ' + player.get("displayname") + ' ';
        }
        sendChat("GroupLoot", target + msg , null, {noarchive:true});
    }
///// Character linking /////

    /**
     * add the character to the list of active characters
     */
    const addCharacter = (name) => {
        let char;
        
        char = getCharacterByName(name);
        
        if(char) {  

            if(!state.grouploot.characters.includes(char.id)) {
                state.grouploot.characters.push(char.id);
            }
            initHandout(char);
            updateHandouts();
        }
        else {
            msgPlayer("Character Not Found: " + name);
        }
        msgPlayer("Character Added: " + name)
    }

    const setGroup = (name) => {

        group = getCharacterByName(name);
        
        if(!group) {
            group = createObj("character", {
                name: name
            });
            state.groupid = group.id;
        }

        initHandout(group);
        updateHandouts();
        msgPlayer("Group Set: " + name)
    }



///// Currency Transfering /////

    /**
     * transfer coins of specified type from source character to target character
     * @param {string} coin 
     * @param {int} ammount 
     * @param {object} source 
     * @param {object} target 
     */
    const transferCurrency = (coin, ammount, sourcename, targetname) => {
        let sourceattr;
        let targetattr;
        let source;
        let target;

        source = getCharacterByName(sourcename);
        target = getCharacterByName(targetname);

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

    /**
     * gets the name character attribute object from the character sheet with the supplied id
     * @param {string} name 
     * @param {string} id 
     */
    const getAttr = (name, id) => {
        if(!id) {
            id = group.id;
        }
        return findObjs({
            _type:"attribute",
            _characterid: id,
            name: name
        })[0];
    }


///// Item Transfers /////

    /**
     * transfer the id item from the source character to the target character
     * @param {string} id 
     * @param {object} source 
     * @param {object} target 
     */
    const transferItem = (name, sourcename, targetname) => {
        let item;
        let items;
        let prop;
        let source;
        let target;

        source = getCharacterByName(sourcename);
        target = getCharacterByName(targetname);

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

            if(items[prop]._itemname.get("current") === name) {
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

    /**
     * get an object listing all the items of the identified character by id
     * @param {string} charid 
     */
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

//// Update Loot Handout ////

    /**
     * opens the Character sheet
     * @param {object} character 
     */
    const linkCharHandout = (character) => {
        initHandout(character);
        updateHandout(character.id);
        //TODO: set visiblity for new handout for character player and pop it open
    }

    /**
     * creates a loot handout for the supplied character
     * @param {object} character 
     */
    const initHandout = (character) => {
        let handoutPage;
        let id;
        let name;

        id = character.id;
        name = character.get("name");
        handoutPage = findObjs({
            _type:"handout",
            name: name + " Loot"
        }, {caseInsensitive: true});

        if(handoutPage.length <=0) {
            handoutPage = createObj("handout", {
                name: name + " Loot"
            })
        }
        else {
            handoutPage = handoutPage[0];
        }
        if(character === group){
            handoutPage.set("inplayerjournals", "all")
        }
        else {
            handoutPage.set("inplayerjournals", player.id);
        }
        handouts[id] = handoutPage;
    }

    /**
     * updates all handouts
     */
    const updateHandouts = () => {
        let i;

        updateHandout(state.groupid);

        for(i=0;i<state.grouploot.characters.length; i++) {
            updateHandout(state.grouploot.characters[i]);
        }
    }

    /**
     * updates the handout of the character by id
     * @param {string} charid 
     */
    const updateHandout = (charid) => {

;       handout = getCharacterHandout(getCharacterById(charid));
        handouttext = "<a href='`!grouploot update'>update</a></b>";

        updateCurrency(charid);
        updateItems(charid);
        handouttext = applyStyles(handouttext, styles);
        handout.set("notes", handouttext);
    };

    const getCharacterHandout = (char) => {
        let handout;

        handout = findObjs({
            _type:"handout",
            name:char.get("name") + " Loot"
        });

        if(handout.length > 0) {
            handout = handout[0];
        }
        return handout;
    }

    /**
     * update the Currancy in the handout for the character by id
     * @param {string} charid 
     */
    const updateCurrency = (charid) => {
        startTable("currency");
        handouttext += "<tr><td><span style='{header}'><b>Coin</b></span></td><td><b>Qty</b></td>";
        if(charid === group.id) {
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

    /**
     * add an attribute display (used for currency) to the loot handout
     * @param {string} label 
     * @param {string} id 
     * @param {string} charid 
     */
    const addAttr = (label, id, charid) => {
        let attrObj = findObjs({
            _type:"attribute",
            _characterid:charid,
            name:id
        })

        if(attrObj.length >= 1) {
            attrObj = attrObj[0];
        }
        else{
            return;
        }

        if(attrObj.get("current") != "") {
            handouttext += "<tr><td><b>" + label + ":</b></td>" +
                "<td><div style='{coinbutton}{coincolor"+id+"}'>" + attrObj.get("current") + "</div></td>";
            if(charid === group.id) {
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

    /**
     *  update display of the items in the loot handout
     * @param {string} charid 
     */
    const updateItems = (charid) => {
        startTable("items");
        handouttext += "<tr><td><b>Item</b></td><td><b>Qty</b></td><td><b>Description</b></td>";

        if(charid === group.id){
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
    };

    /**
     * add an item to the loot handout
     * @param {string} name 
     * @param {int} count 
     * @param {string} desc 
     * @param {string} charid 
     */
    const addItem = (name, count, desc, charid ) => {
        let character = getCharacterById(charid);
        let targetCharacter;

        handouttext += "<tr><td>" + name + "</td>" + 
            "<td> " + count + "</td>" + 
            "<td>" + desc + "</td>";

        if(charid === group.id) {
            handouttext += "<td><a href = '`!grouploot takeitem " + name + "'>Take</a></td>";
        }
        else {
            handouttext += "<td><a href = '`!grouploot giveitem " + name + "|"+character.get("name") + "|" + group.get("name") +"'>" + group.get("name") + "</a></td>";
            
            for(let i=0; i < state.grouploot.characters.length; i++) {
                targetCharacter = getCharacterById(state.grouploot.characters[i]).get("name");
                handouttext += "<td><a href = '`!grouploot giveitem " + name + "|" + character.get("name") + "|" + targetCharacter + "'>" + targetCharacter + "</a></td>";
            }
        }
        handouttext += "</tr>";
    };

///// Table Setup /////   
    /**
     * creates the text for a table and applies it to the handouttext variable
     * @param {string} id id to be assigned to the table element
     */
    const startTable = (id) => {
        handouttext +='<table style="{table}" id="'+ id +'"><tbody></tbody>';
    };

    /**
     * adds the end of a table to the handouttext string
     */
    const endTable = () => {
        handouttext +="</tbody></table>";
    };

//// Styling code /////
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

    /**
     * replaces any {style} tags in the text with the full style text from the styles lookup object
     * @param {string} text 
     * @param {object} styles 
     */
    const applyStyles = (text, styles) => {
        let replaceregexp;
        for(let style in styles) {
            replaceregexp = new RegExp("{" + style + "}", "g");
            text = text.replace(replaceregexp, styles[style]);
        }
        return text;
    }

    return {
        init: init,
        msgHandler:msgHandler,
        update:updateHandouts
    };
})();

///// Listeners /////

on('ready', function() {
    GroupLoot.init();
});

on('chat:message', (msg) => {
    GroupLoot.msgHandler(msg);
});

on('change:attribute', function (){
    GroupLoot.update();
});