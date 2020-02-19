// TODO
//
// This one acts in the context of the panel in the Dev Tools
//
// Can use
// chrome.devtools.*
// chrome.extension.*

/**
 * README: do F12 to open the panel and then CTRL+SHIFT+J to open devtools to the devtools panel
 * make sure the console filter is not "hide all" - set it to default
 *
 * @param content
 * @param chrome
 * @param chrome.runtime
 * @param chrome.runtim.sendMessage
 */
var debug = function( content ) {
    console.log( '[panel.js]: '+  JSON.stringify( content ) );
    // var o = { type: 'debug', content: content }
    // chrome.runtime.sendMessage( o, function( response ) {
    //     console.log( response );
    // });
}

/**
 * @param $
 * @param jQuery
 */
var extend = function ($) {$.createNamespace = function () {var a = arguments, o = null, i, j, d;for (i = 0; i < a.length; i = i + 1) {d = a[i].split(".");o = window;for (j = 0; j < d.length; j = j + 1) {o[d[j]] = o[d[j]] || {};o = o[d[j]];}} return o; };}
extend(jQuery);

var foe = jQuery.createNamespace( 'com.scibuff.foe.gbg' );


( function( $ ) {

    foe.data = function(){

        var tmp = {};

        tmp.aux = {};
        tmp.aux.leaderboard = {};
        // requires ECMA 5+
        tmp.aux.leaderboard.isEmpty = function(){ return Object.keys(tmp.data.leaderboard).length === 0 && tmp.data.leaderboard.constructor === Object }
        tmp.aux.leaderboard.pack = function(){
            // one way to reduce the footprint further is to use hex for ids instead of dec
            var board = {};
                for (var playerId in tmp.data.leaderboard){
                    var player = tmp.data.leaderboard[playerId];
                    var p = tmp.aux.player.pack(player);
                    board[playerId] = p;
                }
            return board;
        };
        tmp.aux.player = {};
        tmp.aux.player.pack = function(player){
            var p = {
                /*id: player.id,*/ // the id will be stored as the object key, no need to store is again
                r: player.rank,
                nw: player.negotiationsWon,
                bw: player.battlesWon,
                o: player.order
            };
            return p;
        };
        tmp.aux.getSnapshotValue = function( id, key, defaultValue ){
            if ( tmp.data && tmp.data.snapshot && tmp.data.snapshot.d && tmp.data.snapshot.d[id] ){
                var playerData = tmp.data.snapshot.d[id];
                if ( playerData[key] ){ return playerData[key]; }
            }
            return defaultValue;
        };

        tmp.data = {};

        tmp.data.snapshot = {};
        tmp.data.leaderboard = {};

        tmp.data.options = {
            'autosync': true,
            'autosync-time': 60000, // 60 seconds
            'storage-key': 'com.scibuff.foe-gbg.snapshot',
            'storage-key-timestamp': 'com.scibuff.foe-gbg.timestamp',
        };

        tmp.getStorageKey = function(){ return tmp.data.options['storage-key']; };

        tmp.saveSnapshotData = function(){
            var storageKey = tmp.getStorageKey();
            var data = {};
            data[storageKey] = tmp.data.snapshot;
            chrome.storage.local.set(data, function() {
                // Notify that we saved.
                // debug('Snapshot saved');
                foe.data.updateTimestamp();
            });
        };

        var pub = {};

        pub.debug = function(){ debug(tmp.data); };
        pub.addLeaderboardPlayer = function(player){ if ( player && player.id ){ tmp.data.leaderboard[ player.id ] = player; }
        };
        pub.getLeaderboardPlayer = function(id){ return tmp.data.leaderboard[id]; };

        pub.getSnapshotNegs = function(id){ return tmp.aux.getSnapshotValue(id, 'nw', -1 ); };
        pub.getSnapshotFights = function(id){ return tmp.aux.getSnapshotValue(id, 'bw', -1 ); };

        pub.getRankedLeaderboard = function(){

            var board = [];
            var size = Object.keys(tmp.data.leaderboard).length;
            for (var order = 0; order < size; order++ ){
                for (var playerId in tmp.data.leaderboard){
                    var player = tmp.data.leaderboard[playerId];
                    if ( player.order == order ){
                        board.push(player);
                        break;
                    }
                }
            }
            return board;
        };

        pub.deleteSnapshot = function(){
            tmp.data.snapshot = {};
            tmp.saveSnapshotData();
        }

        pub.takeSnapshot = function(){
            // debug('taking a snapshot');
            if ( tmp.aux.leaderboard.isEmpty() ){
                // debug('leaderboard is empty');
                return;
            }
            tmp.data.snapshot = {
                d: tmp.aux.leaderboard.pack(),
                t: new Date().valueOf()
            };
            tmp.saveSnapshotData();
        };

        pub.initialize = function(f){

            //debug('foe.data initializing ...');
            var storageKey = tmp.getStorageKey();
            chrome.storage.local.get([storageKey], function(result) {
                if ( result[storageKey] ) {
                    tmp.data.snapshot = result[storageKey];
                }
                //debug('snapshot data');
                //debug(result);

                // make the callback only here, after the data has been loaded !!!
                //debug('foe.data initialized');
                f.call();

            });

            chrome.storage.onChanged.addListener(function(changes, namespace) {
                for (key in changes) {
                    debug('Storage key '+key+' in namespace '+namespace+' changed. ');
                }
            });
        };

        pub.updateTimestamp = function(){
            var text = 'no data';
            if ( tmp.data && tmp.data.snapshot && tmp.data.snapshot.t ){
                var date = new Date( tmp.data.snapshot.t );
                text = date.toISOString();
            }
            $('#for-gbg-last-update').text( text );
        };

        return pub;
    }();

    foe.net = function(){
        var tmp = {};
        tmp.aux = {};

        tmp.options = {};
        tmp.options.arc = {
            bonus: 1.90
        };
        tmp.options.player = {
            id: 0,
            lang: 'en'
        };
        tmp.options.html = {
            ids: {
                leaderboard: {
                    left: 'players-1-40',
                    right: 'players-41-80'
                },
                soh : {
                    left: 'soh-left',
                    right: 'soh-right'
                },
                treasury : {
                    left: 'treasury-left',
                    right: 'treasury-right'
                },
                update: 'for-gbg-last-update'
            }
        };

        var pub = {};

        /**
         * @param request
         * @param request.request
         * @param request.request.postData
         * @param content
         * @param o
         * @param o.requestMethod
         * @param o.requestClass
         * @param o.responseData
         */
        tmp.processRequestContent = function ( request, content ){

            var json = JSON.parse( content );
            if ( !json || !json.length ){ debug('panel.js tmp.processRequestContent failed'); return ; }

            for ( var i = 0; i < json.length; i++ ){
                var o = json[i];
                if ( o && o.requestClass && o.requestClass == "GuildBattlegroundService" ){

                    if ( o.requestMethod == "getPlayerLeaderboard" ){
                        tmp.processLeaderboard( o.responseData );
                    }
                }
                if ( o && o.requestClass && o.requestClass == "ClanService" ){

                    if ( o.requestMethod == "getTreasury" ){
                        tmp.processTreasury( o.responseData );
                    }
                }
                if ( o && o.requestClass && o.requestClass == "OtherPlayerService" ){

                    if ( o.requestMethod == "visitPlayer" ){
                        tmp.processPlayerData( o.responseData );
                    }
                }
                if ( o && o.requestClass && o.requestClass == "GuildBattlegroundStateService" ) {

                    if ( o.requestMethod == "getState" ){

                        if ( o && o.responseData && o.responseData.playerLeaderboardEntries ) {
                            tmp.processLeaderboard( o.responseData.playerLeaderboardEntries );
                        }
                        else {
                            debug('no o.responseData.playerLeaderboardEntries data');
                        }
                    }
                }
            }
        };

        tmp.processPlayerData = function ( data ){

            if ( !data ){
                console.log('no resource data');
                return;
            }
            foe.sohs.setData( data );
            tmp.printSoH();
        }

        tmp.processTreasury = function ( data ){

            if ( !data || !data.resources ){
                console.log('no resource data');
                return;
            }
            foe.treasury.setData( data.resources );
            tmp.printTreasury();
        }

        /**
         *
         * @param list
         * @param gb
         * @param gb.current_progress
         * @param gb.max_progress
         * @param gb.entity_id
         */
        tmp.processLeaderboard = function ( list ){

            //debug('tmp.processLeaderboard: list.length: ' + list.length);

            for ( var i = 0; i < list.length; i++ ){

                var item = list[i];
                var player = {
                    id: item.player['player_id'],
                    name: item.player['name'],
                    avatar: item.player['avatar'],
                    rank: item['rank'],
                    negotiationsWon: tmp.aux.getIntValue( item, 'negotiationsWon' ),
                    battlesWon: tmp.aux.getIntValue( item, 'battlesWon' ),
                    order: i
                }
                // more players can share the same rank, so we need the "order" field to keep track
                // of the order (unless we sort based on score later on)

                foe.data.addLeaderboardPlayer(player);

            }
            //debug( 'Process Leaderboard');
            tmp.printLeaderboard();

        };

        tmp.aux.getIntValue = function(o,key){
            if ( o && o[key] ){ return o[key]; }
            return 0;
        }

        tmp.printSoH = function(){

            var bodyLeft = $('#' + tmp.options.html.ids.soh.left + ' > tbody' );
            var bodyRight = $('#' + tmp.options.html.ids.soh.right + ' > tbody' );

            bodyLeft.empty();
            bodyRight.empty();

            var players = foe.sohs.getData();

            var size = Object.keys(players).length;

            var leftMax = Math.min( 40, size );
            var rightMax = Math.max( 40, size );

            var rows = [];
            for ( var id in players ){
                var player = players[id];
                rows[player.rank] = player;
            }

            // print left
            for ( var i = 0; i < leftMax; i++ ){
                var player = rows[i];
                tmp.aux.printSoHRow( bodyLeft, player );

            }
            // print right
            if ( size > 40 ) {
                for ( var i = 40; i < rightMax; i++ ){
                    var player = rows[i];
                    tmp.aux.printSoHRow( bodyRight, player );
                }
            }

        }

        tmp.aux.printSoHRow = function ( parent, player ) {

            var html = '<tr>'
                + '<td>' + ( player.rank + 1 ) + '</td>'
                + '<td class="player-name">' + player.name + '</td>'
                + '<td>' + player.levels[0] + '</td>'
                + '<td>' + player.levels[1] + '</td>'
                + '<td>' + player.levels[2] + '</td>'
                + '<td>' + player.levels[3] + '</td>'
                + '<td>' + player.levels[4] + '</td>'
                + '</tr>';
            var tr = $( html );

            parent.append(tr);

        }

        tmp.printLeaderboard = function(){

            var bodyLeft = $('#' + tmp.options.html.ids.leaderboard.left + ' > tbody' );
            var bodyRight = $('#' + tmp.options.html.ids.leaderboard.right + ' > tbody' );

            bodyLeft.empty();
            bodyRight.empty();

            var players = foe.data.getRankedLeaderboard();

            //debug('tmp.printLeaderboard: players');
            //debug(players);

            var leftMax = Math.min( 40, players.length );
            var rightMax = Math.max( 40, players.length );

            // print left
            for ( var i = 0; i < leftMax; i++ ){
                var player = players[i];
                tmp.aux.printLeaderboardRow( bodyLeft, player );

            }
            // print right
            if ( players.length > 40 ) {
                for ( var i = 40; i < rightMax; i++ ){
                    var player = players[i];
                    tmp.aux.printLeaderboardRow( bodyRight, player );
                }
            }
        };

        tmp.aux.getSnapshotNegs = function(id){ return foe.data.getSnapshotNegs(id); };
        tmp.aux.getSnapshotFights = function(id){ return foe.data.getSnapshotFights(id); };

        tmp.aux.printLeaderboardRow = function(parent,player){

            var score = player.negotiationsWon * 2 + player.battlesWon;

            var sn = tmp.aux.getSnapshotNegs(player.id);
            var sf = tmp.aux.getSnapshotFights(player.id);
            var deltaNegs = (sn > 0) ? player.negotiationsWon - sn : 0;
            var deltaFights = (sf > 0) ? player.battlesWon - sf : 0;
            var dnClass = ( deltaNegs > 0 ) ? ' class="delta-pos"' : ' class=""';
            var dfClass = ( deltaFights > 0 ) ? ' class="delta-pos"' : ' class=""';

            var html = '<tr>'
                + '<td>' + player.rank + '</td>'
                + '<td class="player-name">' + player.name + '</td>'
                + '<td>' + score + '</td>'
                + '<td>' + player.negotiationsWon + '</td>'
                + '<td>' + player.battlesWon + '</td>'
                + '<td' + dnClass + '>' + deltaNegs + '</td>'
                + '<td' + dfClass + '>' + deltaFights + '</td>'
                + '</tr>';
            var tr = $( html );

            parent.append(tr);

        };

        tmp.printTreasury = function(){

            var bodyLeft = $('#' + tmp.options.html.ids.treasury.left + ' > tbody' );
            var bodyRight = $('#' + tmp.options.html.ids.treasury.right + ' > tbody' );

            bodyLeft.empty();
            bodyRight.empty();

            var treasury = foe.treasury.getData();

            var lefts = [];
            var rights = [];

            var size = Object.keys(treasury).length;

            var half = Math.ceil( size / 2 );
            for (var i = 1; i <= size; i++ ) {
                var era = treasury[i];
                if ( era ) {
                    if ( i <= half ) {
                        lefts.push( era );
                    }
                    else {
                        rights.push( era );
                    }
                }
            }

            // print left
            for ( var i = 0; i < lefts.length; i++ ){
                tmp.aux.printTreasuryEra( bodyLeft, lefts[i] );
            }
            // print right
            for ( var i = 0; i < rights.length; i++ ){
                tmp.aux.printTreasuryEra( bodyRight, rights[i] );
            }
        };

        tmp.aux.printTreasuryEra = function(parent,era){

            var total = 0;
            for ( var j = 1; j <= 5; j++ ){
                var item = era[j];
                total += item.value;
                tmp.aux.printTreasuryRow(parent,item);
            }

            var html = '<tr>'
                + '<td class="resource-name">Total: </td>'
                + '<td class="resource-value">' + tmp.aux.formatTresuryValue(total ) + '</td>'
                + '</tr><tr><td colspan="2" class="empty-row">&nbsp;</td></tr>';
            var tr = $(html);
            parent.append(tr);

        }
        tmp.aux.printTreasuryRow = function(parent,item){

            var html = '<tr>'
                + '<td class="resource-name">' + item.name + '</td>'
                + '<td class="resource-value">' + tmp.aux.formatTresuryValue( item.value ) + '</td>'
                + '</tr>';
            var tr = $( html );

            parent.append(tr);
        };
        tmp.aux.formatTresuryValue = function(n){
            return n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
        }

        tmp.buttons = { delete: null, take: null, load: null };
        tmp.takeSnapshot = function(){
            foe.data.takeSnapshot();
            tmp.printLeaderboard();
        }
        tmp.deleteSnapshot = function(){ foe.data.deleteSnapshot(); };

        tmp.debug = {};
        tmp.debug.data = {};
        tmp.debug.show = function(){
            //debug(tmp.data);
            //debug(tmp.debug.data);
        };

        /**
         * chrome.devtools.network.onRequestFinished.addListener
         * @param request
         * @param request.request
         * @param request.request.postData.mimeType
         * @param request.getContent
         */
        pub.handler = function( request ){

            if ( !request || !request.request ){ return; }

            if ( request.request.method = 'POST' && request.request.postData && request.request.postData.mimeType == "application/json" ){
                request.getContent( function( content, encoding ){
                    tmp.processRequestContent( request, content );
                });
            }

        };
        pub.initialize = function(){
            tmp.buttons.delete = $('#snapshot-button-delete-snapshot');
            tmp.buttons.delete.click(function(){ tmp.deleteSnapshot(); });
            //tmp.buttons.load = $('#snapshot-button-load');
            //tmp.buttons.load.click(function(){ tmp.loadLastSnapshot(); });
            tmp.buttons.take = $('#snapshot-button-take-snapshot');
            tmp.buttons.take.click(function(){ tmp.takeSnapshot(); });
            foe.data.updateTimestamp();
        };

        return pub;
    }();

    foe.options = function(){
        var tmp = {};
        var pub = {};
        return pub;
    }();

    foe.guild = function(){
        var tmp = {};
        tmp.players = [
            { id: "2101362", name: "Malc999"},
            { id: "4554866", name: "jenkoroid"},
            { id: "4523216", name: "mopasswiniopas"},
            { id: "3456739", name: "Twodon"},
            { id: "2251713", name: "ArmAgeddon1986"},
            { id: "4854322", name: "Ykra82"},
            { id: "4242068", name: "BuBii"},
            { id: "2067179", name: "GioGoBE"},
            { id: "4522851", name: "CodyBeartheGreat"},
            { id: "1634025", name: "MyLittleLady"},
            { id: "1727607", name: "O1af"},
            { id: "5770103", name: "Winstn"},
            { id: "2668311", name: "dabylover"},
            { id: "3435319", name: "Portodragao"},
            { id: "5288551", name: "Lupul cel rau"},
            { id: "3437627", name: "williamandaman"},
            { id: "2228072", name: "King Kong the 2nd"},
            { id: "7380673", name: "Cyrus the Red King"},
            { id: "1940518", name: "wphillips1969"},
            { id: "4273370", name: "jocokitan"},
            { id: "6153011", name: "Bandzhius"},
            { id: "1386881", name: "sir p of scoles"},
            { id: "4471913", name: "dick ryder"},
            { id: "2638320", name: "trips"},
            { id: "1530724", name: "King Donnie"},
            { id: "529245",  name: "plugl"},
            { id: "9717564", name: "Pericles the Warrior 552"},
            { id: "6869907", name: "scibuff"},
            { id: "3440035", name: "Red forever"},
            { id: "4534957", name: "Viriatus The Stubborn"},
            { id: "3448613", name: "The Gerbil"},
            { id: "5250934", name: "Tomasz Wilczynski"},
            { id: "7371009", name: "Archie the Awesome"},
            { id: "5264800", name: "Pedro Marques"},
            { id: "3443792", name: "ArturDix37"},
            { id: "707600",  name: "nalinranawaka"},
            { id: "7429131", name: "KOKOS76"},
            { id: "3432275", name: "waldecal1"},
            { id: "4855344", name: "VincentGregg"},
            { id: "9815594", name: "KingXIII"},
            { id: "6773439", name: "Charles the Saviour"},
            { id: "5306764", name: "CRjonz"},
            { id: "3167499", name: "ramon3141"},
            { id: "7084358", name: "Il Penseroso"},
            { id: "4455672", name: "Dr Mac"},
            { id: "8533562", name: "ExCiT3R"},
            // { id: "4538742", name: "Sylvik Silverspear"},
            { id: "4415427", name: "Dibble Oak"},
            { id: "7141157", name: "Michael Knigth Lawgiver"},
            { id: "5691007", name: "Casticus the Sly 271"},
            { id: "6170110", name: "ROginia"},
            { id: "9508418", name: "Trcz"},
            { id: "2324976", name: "RockyFU"},
            { id: "10227447", name: "Mad Max McGill"},
            { id: "10656113", name: "Miss Megan"},
            { id: "4517894", name: "Skittles The Terrible"},
            { id: "2089363", name: "daveb57"},
            { id: "6236886", name: "Aaron Dean"},
            { id: "4241913", name: "barcardi"},
            { id: "9832364", name: "TripSwe"},
            { id: "8420992", name: "Odin Valhala"},
            { id: "9676621", name: "patsygirl"},
            { id: "9428118", name: "Garvisimo the Glorious"},
            { id: "6822800", name: "Immortal Enemy"},
            { id: "8136844", name: "Goluff"},
            { id: "4561750", name: "BorisSF2"},
            { id: "8613293", name: "king willyboy"},
            { id: "10300883", name: "luisosmed"},
            { id: "9239518", name: "Louis the Just 378"},
            { id: "10494477", name: "Holydr4gon"},
            { id: "10520763", name: "Ratibor Iron Fist"},
            { id: "6293528", name: "Maya Myoho"},
            { id: "9349175", name: "big eel"},
            { id: "9578694", name: "Red9thebest"},
            { id: "2925329", name: "SO7IW"},
            { id: "7292743", name: "pashow"},
            { id: "10104023", name: "Brutus999"},
            { id: "7995330", name: "Crystal Sea Star"}
        ];

        var pub = {};

        pub.players = function(){
            return tmp.players;
        };

        return pub;
    }();

    foe.sohs = function(){
        var tmp = {};
        tmp.data = {};
        var pub = {};

        tmp.setPlayerLevels = function( id, levels ){
            if ( tmp.data[ id ] ){
                tmp.data[id].levels = levels;
            }
        }

        pub.setData = function( data ){
            var entities = data.city_map.entities;
            var levels = [0,0,0,0,0];
            for ( var i = 0; i < entities.length; i++ ){
                var entity = entities[i];
                if ( entity.cityentity_id == 'R_MultiAge_Battlegrounds1a' ){ levels[4] = levels[4] + 1; }
                if ( entity.cityentity_id == 'R_MultiAge_Battlegrounds1b' ){ levels[3] = levels[3] + 1; }
                if ( entity.cityentity_id == 'R_MultiAge_Battlegrounds1c' ){ levels[2] = levels[2] + 1; }
                if ( entity.cityentity_id == 'R_MultiAge_Battlegrounds1d' ){ levels[1] = levels[1] + 1; }
                if ( entity.cityentity_id == 'R_MultiAge_Battlegrounds1e' ){ levels[0] = levels[0] + 1; }
            }
            var id = data.other_player.player_id;
            tmp.setPlayerLevels( id, levels );
        }

        pub.getData = function(){ return tmp.data; }

        pub.initialize = function(){
            var players = foe.guild.players();
            for ( var i = 0; i < players.length; i++ ){
                var player = players[i];
                tmp.data[ player.id ] = {
                    levels: [0,0,0,0,0],
                    name: player.name,
                    rank: i
                }
            }
        }

        return pub;
    }();

    foe.treasury = function(){
        var tmp = {};
        tmp.treasury = {};

        var pub = {};
        pub.setData = function( resources ){

            var raw = {};

            for ( var resource in resources ){
                var o = tmp.goods[resource];
                if ( o && o.era ){
                    if ( !raw[ o.era ] ){ raw[ o.era ] = {}; }
                    o.value = resources[ resource ];
                    raw[ o.era ][ o.order ] = o;
                }
            }
            tmp.treasury = raw;

            if ( ! tmp.treasury['1'] ){
                tmp.treasury['1'] = {
                    '1': {era:1,order:1,name:'Marble',value:0},
                    '2': {era:1,order:2,name:'Lumber',value:0},
                    '3': {era:1,order:3,name:'Dye',value:0},
                    '4': {era:1,order:4,name:'Stone',value:0},
                    '5': {era:1,order:5,name:'Wine',value:0}
                }
            }

        }
        pub.getData = function(){
            return tmp.treasury;
        }

        tmp.good_eras = {

        }
        tmp.goods = {
            guild_expedition_point: 0,
            medals: 0,
            guild_championship_trophy_gold: 0,

            bronze: { era: 3, order: 1, name: 'Copper'},
            biotech_crops: { era: 17, order: 1, name: 'BioTech Crops'},
            asbestos: { era: 8, order: 1, name: 'Asbestos'},
            fusion_reactors: { era: 17, order: 2, name: 'Fusion Reactors'},
            papercrete: { era: 12, order: 2, name: 'Papercrete'},
            electromagnets: { era: 11, order: 2, name: 'Electromagnets'},
            superconductors: { era: 13, order: 5, name: 'Superconductors'},
            purified_water: { era: 13, order: 4, name: 'Purified Water'},
            lubricants: { era: 17, order: 3, name: 'Lubricants'},
            pearls: { era: 15, order: 4, name: 'Pearls'},
            robots: { era: 11, order: 5, name: 'Robots'},
            translucent_concrete: { era: 12, order: 5, name: 'Translucent Concrete'},
            cloth: { era: 2, order: 1, name: 'Cloth'},
            gas: { era: 11, order: 3, name: 'Gas'},
            machineparts: { era: 8, order: 3, name: 'Machine Parts'},
            bionics: { era: 11, order: 1, name: 'Bionics Data'},
            brick: { era: 4, order: 1, name: 'Bricks'},
            ropes: { era: 4, order: 4, name: 'Ropes'},
            salt: { era: 4, order: 5, name: 'Salt'},
            glass: { era: 4, order: 2, name: 'Glass'},
            herbs: { era: 4, order: 3, name: 'Dried Herbs'},
            tinplate: { era: 8, order: 5, name: 'Tinplate'},
            superalloys: { era: 17, order: 5, name: 'Superalloys'},
            tar: { era: 6, order: 4, name: 'Tar'},
            algae: { era: 13, order: 1, name: 'Algae'},
            biogeochemical_data: { era: 13, order: 2, name: 'Biogeochemical Data'},
            wire: { era: 6, order: 5, name: 'Wires'},
            fertilizer: { era: 7, order: 2, name: 'Fertilizer'},
            bioplastics: { era: 14, order: 2, name: 'Bioplastics'},
            smart_materials: { era: 12, order: 4, name: 'Smart Materials'},
            nutrition_research: { era: 12, order: 1, name: 'Nutrition Research'},
            nanoparticles: { era: 13, order: 3, name: 'Nanoparticles'},
            data_crystals: { era: 16, order: 2, name: 'Data Crystals'},
            gems: { era: 2, order: 3, name: 'Jewelry'},
            lead: { era: 2, order: 4, name: 'Iron'},
            ebony: { era: 2, order: 2, name: 'Ebony'},
            plastics: { era: 11, order: 4, name: 'Plastics'},
            explosives: { era: 8, order: 2, name: 'Explosives'},
            honey: { era: 3, order: 4, name: 'Honey'},
            biolight: { era: 15, order: 2, name: 'Biolight'},
            plankton: { era: 15, order: 5, name: 'Plankton'},
            artificial_scales: { era: 15, order: 1, name: 'Artificial Scales'},
            corals: { era: 15, order: 3, name: 'Corals'},
            ai_data: { era: 14, order: 1, name: 'AI data'},
            mars_microbes: { era: 17, order: 4, name: 'Mars Microbes'},
            paper: { era: 6, order: 2, name: 'Paper'},
            nanowire: { era: 14, order: 3, name: 'Nanowires'},
            paper_batteries: { era: 14, order: 4, name: 'Paper batteries'},
            transester_gas: { era: 14, order: 5, name: 'Transester gas'},
            gold: { era: 3, order: 2, name: 'Gold'},
            coke: { era: 7, order: 1, name: 'Coke'},
            coffee: { era: 6, order: 1, name: 'Coffee'},
            golden_rice: { era: 16, order: 3, name: 'Golden Rice'},
            rubber: { era: 7, order: 3, name: 'Rubber'},
            cryptocash: { era: 16, order: 1, name: 'Cryptocash'},
            tea_silk: { era: 16, order: 5, name: 'Tea Silk'},
            talc: { era: 5, order: 5, name: 'Talc Powder'},
            basalt: { era: 5, order: 1, name: 'Basalt'},
            silk: { era: 5, order: 4, name: 'Silk'},
            porcelain: { era: 6, order: 3, name: 'Porcelain'},
            steel: { era: 10, order: 5, name: 'Steel'},
            luxury_materials: { era: 9, order: 4, name: 'Luxury Materials'},
            preservatives: { era: 12, order: 3, name: 'Preservatives'},
            dna_data: { era: 10, order: 1, name: 'Genome Data'},
            packaging: { era: 9, order: 5, name: 'Packaging'},
            convenience_food: { era: 9, order: 1, name: 'Conveniece Food'},
            filters: { era: 10, order: 2, name: 'Industrial Filters'},
            renewable_resources: { era: 10, order: 3, name: 'Renewable Resources'},
            petroleum: { era: 8, order: 4, name: 'Gasoline'},
            ferroconcrete: { era: 9, order: 2, name: 'Ferroconcrete'},
            semiconductors: { era: 10, order: 4, name: 'Semiconductors'},
            granite: { era: 3, order: 3, name: 'Granite'},
            flavorants: { era: 9, order: 3, name: 'Flavorants'},
            whaleoil: { era: 7, order: 5, name: 'Whale Oil'},
            nanites: { era: 16, order: 4, name: 'Nanites'},
            textiles: { era: 7, order: 4, name: 'Textiles'},
            brass: { era: 5, order: 2, name: 'Brass'},
            marble: { era: 3, order: 5, name: 'Alabaster'},
            gunpowder: { era: 5, order: 3, name: 'Gunpowder'},
            limestone: { era: 2, order: 5, name: 'Limestone'},
        }

        return pub;
    }();

    foe.utils = function(){

        // public fields
        //var pub = {};
        //return pub;
        return {};
    }();

    foe.ui = function(){
        var tmp = {};
        var pub = {};

        pub.initialize = function(){

            $('#nav td a:not(:first)').addClass('inactive');
            $('#data .data-container').hide();
            $('#data .data-container:first').show();

            $('#nav td a').click(function(e){
                e.preventDefault();
                var data = $(this).attr('data');

                if ( $(this).hasClass('inactive') ){
                    $('#nav td a').addClass('inactive');
                    $(this).removeClass('inactive');

                    $('#data .data-container').hide();
                    $('#' + data).fadeIn('slow');
                }
            });
        }

        return pub;
    }();

    foe.players = function(){

        var tmp = {};
        tmp.avatars = {
            'anwar': 163,
            'ashley': 262,
            'bettie': 69,
            'bogdan': 83,
            'carnival_moon': 272,
            'carnival_sun': 271,
            'caesar': 188,
            'celeas': 84,
            'count': 137,
            'doyle': 245,
            'eddie': 251,
            'einstein': 230,
            'frida': 162,
            'frosty': 39,
            'galileo': 250,
            'gandhi': 253,
            'hugh': 106,
            'jenny': 255,
            'jim': 180,
            'jodido': 63,
            'joeff': 254,
            'johnson': 265,
            'jones': 159,
            'karl': 87,
            'kekoa': 212,
            'lawrence': 158,
            'maharaja': 247,
            'maharani': 248,
            'mahatma': 70,
            'makeda': 123,
            'marian': 152,
            'mata': 157,
            'mayday_hilde': 194,
            'monroe': 249,
            'mummy_female': 218,
            'mummy_male': 217,
            'napoleon': 273,
            'nefertiti': 0,
            'nelson': 122,
            'ruth': 0,
            'samurai': 241,
            'shaka': 124,
            'sven': 261,
            'wahine': 211,
            'yuri': 193,
            'zombie': 177
        };

        tmp.getAvatarSrc = function( avatar ){

            var needle = '_id_';
            var id = 0;
            var strpos = avatar.indexOf( needle );
            if ( strpos > 0 ){
                id = avatar.substring( strpos + needle.length )
            }
            if ( tmp.avatars[ id ] ){ id = tmp.avatars[ id ]; }
            return 'https://foeen.innogamescdn.com/assets/shared/avatars/portrait_' + id + '.jpg';
        };
        tmp.data = {};

        var pub = {};

        pub.initialize = function(){};

        return pub;
    }();

})( jQuery );

chrome.devtools.network.onRequestFinished.addListener( function(request) {
    foe.net.handler( request );
});

//////////////////////////////////////////////////////////////////////////////////////////

var manifest = chrome.runtime.getManifest();
document.getElementById('foe-gbg-version').innerHTML = 'v' + manifest.version;

$(document).ready(function() {
    foe.ui.initialize();
    foe.sohs.initialize();
    foe.data.initialize(function(){
        foe.net.initialize();
    });
});