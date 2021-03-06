var VIRTUAL_SERVER_NUM = 16;
var ok_flag = 0;
var add_flag = 0;

var protocolStatusArray = [
[PROTOCOL_BOTH, firewall_label_tcp_or_udp],
[PROTOCOL_TCP, firewall_label_tcp],
[PROTOCOL_UDP, firewall_label_udp]
];

var filterStatusArray = [
[FILTER_DISABLED, common_off],
[FILTER_ENABLED, common_on]
];

function comparePortAndProtocal(port,protocal,showTarget) {
    var wanPortArray = [];
    var protocalArray = [];
    $('.user_add_line').each( function(i) {
        wanPortArray.push($(this).children().eq(1).text());
        protocalArray.push($(this).children().eq(4).text());
    });
    for(i = 0; i < wanPortArray.length; i++) {
        if(wanPortArray[i] == port && protocalArray[i] == protocal) {
            showQtip(showTarget, ID_hint_virtual_server_has_exist);
            return false;
        }
    }
    return true;
}

function isVaildVirtual() {
    var flagEmpty = 0;
    var virtualServerIPName = $.trim($('#input_server_name').val());
    var virtualServerIPAddress = $.trim($('#input_wan_ip_address').val());
    var virtualServerLanPort = $.trim($('#input_lan_port').val());
    var virtualServerWanPort = $.trim($('#input_wan_port').val());
    var virtualServerProtocal = $.trim($('#select_protocol_status').find("option:selected").text());
    $.each($('.qtip-defaults'), function() {
        $(this).remove();
    });
    if ('' != virtualServerIPName) {
        if (!checkInputChar(virtualServerIPName)) {
            showQtip('input_server_name', firewall_hint_name_valid_type);
            return false;
        }

    } else {
        showQtip('input_server_name', common_message_name_empty);
        return false;
    }

    if ('' != virtualServerWanPort) {
        if (!isVaildSpecialPort(virtualServerWanPort, 'input_wan_port')) {
            return false;
        }
        if(false == comparePortAndProtocal(virtualServerWanPort,virtualServerProtocal, 'input_wan_port')) {
            return false;
        }
    } else {
        showQtip('input_wan_port', firewall_hint_port_empty);
        return false;
    }

    if ('' == virtualServerIPAddress ||
    !isValidIpAddress(virtualServerIPAddress) ||
    !isSameSubnetAddrs(virtualServerIPAddress, dhcpLanIPAddress, dhcpLanNetmask) ||
    !isBroadcastOrNetworkAddress(virtualServerIPAddress, dhcpLanNetmask) ||
    virtualServerIPAddress == dhcpLanIPAddress
    ) {
        showQtip('input_wan_ip_address', dialup_hint_ip_address_empty);
        return false;
    }

    if (virtualServerLanPort != '') {
        if (!isVaildSpecialPort(virtualServerLanPort, 'input_lan_port')) {
            return false;
        }
    } else {
        showQtip('input_lan_port', firewall_hint_port_empty);
        return false;
    }

    return true;
}

function initPage() {
    VIRTUAL_SERVER_NUM = parseInt(g_config_firewall.virtualserver.number,10);
    button_enable('apply', '0');
    initSelectOption('select_protocol_status', protocolStatusArray);
    initSelectOption('select_status', filterStatusArray);
    $('#select_protocol_status').val(PROTOCOL_BOTH);
    $('#select_status').val(FILTER_DISABLED);

    $('.user_add_line').remove();
    getAjaxData('api/dhcp/settings', function($xml) {
        var ret = xml2object($xml);
        if (ret.type == 'response') {
            dhcpPageVar = ret.response;
            initDhcp();
        }
    });
    getAjaxData('api/security/virtual-servers', function($xml) {
        var ret = xml2object($xml);
        var servers = ret.response.Servers.Server;
        var serverStatus;
        var lastServer;

        if (servers) {
            if (servers.length >= VIRTUAL_SERVER_NUM) {
                button_enable('add_item', '0');
            }
            if ($.isArray(servers)) {
                $(servers).each( function(i) {
                    addFilter(
                    $('#service_list tr'),
                    spaceToNbsp(XSSResolveCannotParseChar(servers[i].VirtualServerIPName)),
                    servers[i].VirtualServerWanPort,
                    XSSResolveCannotParseChar(servers[i].VirtualServerIPAddress),
                    servers[i].VirtualServerLanPort,
                    getDArrayElement(protocolStatusArray, servers[i].VirtualServerProtocol, 'value'),
                    getDArrayElement(filterStatusArray, servers[i].VirtualServerStatus, 'value')
                    );
                });
                lastServer = servers[servers.length - 1];
            } else {
                addFilter(
                $('#service_list tr'),
                spaceToNbsp(XSSResolveCannotParseChar(servers.VirtualServerIPName)),
                servers.VirtualServerWanPort,
                XSSResolveCannotParseChar(servers.VirtualServerIPAddress),
                servers.VirtualServerLanPort,
                getDArrayElement(protocolStatusArray, servers.VirtualServerProtocol, 'value'),
                getDArrayElement(filterStatusArray, servers.VirtualServerStatus, 'value')
                );
                lastServer = servers;
            }

            $('#input_server_name').val(lastServer.VirtualServerIPName);
            $('#input_wan_port').val(lastServer.VirtualServerWanPort);
            $('#input_wan_ip_address').val(lastServer.VirtualServerIPAddress);
            $('#input_lan_port').val(lastServer.VirtualServerLanPort);
        } else {
            $('#input_server_name').val("");
            $('#input_wan_port').val("");
            $('#input_wan_ip_address').val("");
            $('#input_lan_port').val("");
        }
    });
}

function openPortToCss() {
    if(($.browser.mozilla) || ($.browser.opera)) {
        $('#service_list').css
        ({
            'table-layout':'fixed',
            'word-break':'break-all',
            'word-wrap':'break-word'
        });
    }
}

$(document).ready( function() {
    initPage();
    openPortToCss();
    $('.user_options').attr('width','105');
    //hide add item control
    $('#add_item_cancel').live('click', function() {
        hideAddItemControl();
        if((1 == add_flag) || (1 == ok_flag)) {
            button_enable('apply', '1');
        }
    });
    //show add item control
    $('#add_item').click( function() {
        if (isButtonEnable('add_item')) {
            showAddItemControl();
            $('.add_item_control input').eq(0).focus();
            button_enable('apply', '0');
        }
    });
    $('#add_item_ok').live('click', function() {
        if (isVaildVirtual()) {
            var serverName = $.trim($('#input_server_name').val());
            var wanPort = $.trim($('#input_wan_port').val());
            var wanAddress = $.trim($('#input_wan_ip_address').val());
            var lanPort = $.trim($('#input_lan_port').val());
            var serverProtocol = $('#select_protocol_status option:selected').text();
            var serverStatus = $('#select_status option:selected').text();

            hideAddItemControl();
            addFilter($('#service_list tr'), spaceToNbsp(XSSResolveCannotParseChar(serverName)), wanPort, XSSResolveCannotParseChar(wanAddress), lanPort, serverProtocol, serverStatus);
            button_enable('apply', '1');
            if ($('.user_add_line').length >= VIRTUAL_SERVER_NUM) {
                button_enable('add_item', '0');
            }
            add_flag = 1;
        }
    });
    var currentAllVal = null;
    var editIndex = null;
    $('.button_edit_list').live('click', function() {
        if (($(".add_item_control:hidden").size() > 0) && ($('#edit_item_ok').size() < 1)) {
            editIndex = $('.button_edit_list').index(this);
            // save the value before user edit
            currentAllVal = $('.user_add_line').eq(editIndex).html();
            var editVirtualServer = $(this).parent().siblings();
            var editserverName = editVirtualServer.eq(0);
            var editserverNameStr = editserverName.html();
            editserverNameStr = nbspToSpace(editserverNameStr);
            var editWanPort = editVirtualServer.eq(1);
            var editLanIpAddr = editVirtualServer.eq(2);
            var editLanPort = editVirtualServer.eq(3);
            var editProtocol = editVirtualServer.eq(4);
            var editStatus = editVirtualServer.eq(5);

            var htmlProtocol = editProtocol.html();
            var htmlStatus = editStatus.html();

            editserverName.html('<input type="text" value="' + XSSResolveHtmlReturnChar(editserverNameStr) + '" id="input_server_name"  maxlength="30"/></td>');
            editWanPort.html('<input type="text" value="' + XSSResolveCannotParseChar(editWanPort.html()) + '" id="input_wan_port"></td>');
            editLanIpAddr.html('<input type="text" value="' + XSSResolveCannotParseChar(editLanIpAddr.html()) + '" id="input_wan_ip_address"></td>');
            editLanPort.html('<input type="text" value="' + XSSResolveCannotParseChar(editLanPort.html()) + '" id="input_lan_port"></td>');

            createSelect(editProtocol, 'select_protocol_status', protocolStatusArray);
            createSelect(editStatus, 'select_status', filterStatusArray);

            $('#select_protocol_status').val(getDArrayElement(protocolStatusArray, htmlProtocol, 'key'));
            $('#select_status').val(getDArrayElement(filterStatusArray, htmlStatus, 'key'));

            $(this).parent().html('<a class="clr_blue" id="edit_item_ok" href="javascript:void(0);">' +
            common_ok + '</a><a class="clr_blue" id="edit_item_cancel" href="javascript:void(0);">' + common_cancel + '</a>');

            hideAddItemControl();
            $('.user_add_line input').eq(0).focus();
            $('#edit_item_cancel').live('click', function() {
                $('.user_add_line').eq(editIndex).html(currentAllVal);
                $('.qtip').qtip('destroy');
                if (!isButtonEnable('add_item')) {
                    button_enable('add_item', '1');
                    if((1 == ok_flag) || (1 == add_flag)) {
                        button_enable('apply', '1');
                    }
                }
                if ($('.user_add_line').length >= VIRTUAL_SERVER_NUM) {
                    button_enable('add_item', '0');
                }
            });
            $('#add_item').live('click', function() {
                if (isButtonEnable('add_item')) {
                    $('.user_add_line').eq(editIndex).html(currentAllVal);
                    $('.qtip').qtip('destroy');
                }
            });
            button_enable('apply', '0');
            button_enable('add_item', '0');
        }
    });
    $('#edit_item_ok').live('click', function() {
        if (isVaildVirtual()) {
            var serverName = $.trim($('#input_server_name').val());
            var wanPort = $.trim($('#input_wan_port').val());
            var wanAddress = XSSResolveCannotParseChar($.trim($('#input_wan_ip_address').val()));
            var lanPort = $.trim($('#input_lan_port').val());
            var serverProtocol = $('#select_protocol_status option:selected').text();
            var serverStatus = $('#select_status option:selected').text();

            hideAddItemControl();
            var editVirtualServer = $(this).parent().siblings();
            editVirtualServer.eq(0).html(spaceToNbsp(XSSResolveCannotParseChar(serverName)));
            editVirtualServer.eq(1).html(XSSResolveCannotParseChar(wanPort));
            editVirtualServer.eq(2).html(XSSResolveCannotParseChar(wanAddress));
            editVirtualServer.eq(3).html(XSSResolveCannotParseChar(lanPort));
            editVirtualServer.eq(4).html(serverProtocol);
            editVirtualServer.eq(5).html(serverStatus);

            $(this).parent().html('<span class=\"button_edit_list clr_blue\">' + common_edit +
            '</span><span class=\"button_delete_list clr_blue\">' + common_delete + '</span>');
            currentAllVal = $('.user_add_line').eq(editIndex).html();
            button_enable('apply', '1');
            button_enable('add_item', '1');
            ok_flag = 1;
            if ($('.user_add_line').length >= VIRTUAL_SERVER_NUM) {
                button_enable('add_item', '0');
            }
        }
    });
    function postData() {
        var submitObject = {};
        var serverArray = [];

        $('.user_add_line').each( function() {
            var server = {
                VirtualServerIPName: nbspToSpace($(this).children().eq(0).html()),
                VirtualServerStatus: getDArrayElement(filterStatusArray, $(this).children().eq(5).text(), 'key'),
                VirtualServerRemoteIP: '',
                VirtualServerWanPort: $(this).children().eq(1).text(),
                VirtualServerWanEndPort: '',
                VirtualServerLanPort: $(this).children().eq(3).text(),
                VirtualServerIPAddress: $(this).children().eq(2).text(),
                VirtualServerProtocol: getDArrayElement(protocolStatusArray, $(this).children().eq(4).text(), 'key')
            };
            serverArray.push(server);
        });
        submitObject = {
            Servers: {
                Server: serverArray
            }
        };

        var submitData = object2xml('request', submitObject);
        saveAjaxData('api/security/virtual-servers', submitData, function($xml) {
            var ret = xml2object($xml);
            if (isAjaxReturnOK(ret)) {
                showInfoDialog(common_success);
                button_enable('apply', '0');
            } else {
                showInfoDialog(common_failed);
                initPage();
            }
        });
    }

    $('#apply').click( function() {
        if (isButtonEnable('apply')) {
            showConfirmDialog(firewall_hint_submit_list_item, postData);
        }
        ok_flag = 0;
        add_flag = 0;
    });
});