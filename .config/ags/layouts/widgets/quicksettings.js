const { Widget, Service, App } = ags;
const { Bluetooth, Battery, Audio, Settings, Network } = ags.Service;
const { execAsync, exec, timeout } = ags.Utils;

class QSMenu extends Service {
    static { Service.register(this); }
    static instance = new QSMenu();
    static opened = '';
    static toggle(menu) {
        QSMenu.opened = QSMenu.opened === menu ? '' : menu;
        QSMenu.instance.emit('changed');
    }

    constructor() {
        super();
        App.instance.connect('window-toggled', (_a, n, v) => {
            if (n === 'quicksettings' && !v) {
                QSMenu.opened = '';
                QSMenu.instance.emit('changed');
            }
        });
    }
}

const arrow = (menu, toggleOn) => ({
    type: 'button',
    className: 'arrow',
    onClick: () => {
        QSMenu.toggle(menu);
        if (toggleOn)
            toggleOn();
    },
    connections: [[QSMenu, button => {
        button.toggleClassName('opened', QSMenu.opened === menu);
    }]],
    child: {
        type: 'icon',
        icon: 'pan-end-symbolic',
        properties: [
            ['deg', 0],
            ['opened', false],
        ],
        connections: [[QSMenu, icon => {
            if (QSMenu.opened === menu && !icon._opened || QSMenu.opened !== menu && icon._opened) {
                const step = QSMenu.opened === menu ? 10 : -10;
                icon._opened = !icon._opened;
                for (let i=0; i<9; ++i) {
                    timeout(5*i, () => {
                        icon._deg += step;
                        icon.setStyle(`-gtk-icon-transform: rotate(${icon._deg}deg);`);
                    });
                }
            }
        }]],
    },
});

const menu = (name, child) => ({
    type: 'box',
    children: [{
        type: 'revealer',
        transition: 'slide_down',
        connections: [[QSMenu, r => r.reveal_child = name === QSMenu.opened]],
        child,
    }],
});

const avatar = {
    type: 'box',
    className: 'avatar',
    children: [{
        type: 'avatar',
        child: {
            type: 'label',
            className: 'user',
            halign: 'start',
            valign: 'end',
            connections: [[Settings, l => l.label = '@'+Settings.userName]],
        },
    }],
};

const sysBtn = (icon, action, className = '') => ({
    type: 'button',
    className,
    onClick: () => ags.Service.System.action(action),
    tooltip: action,
    child: {
        type: 'icon',
        icon,
    },
});

const systemBox = {
    type: 'box',
    orientation: 'vertical',
    halign: 'end',
    valign: 'center',
    children: [
        {
            type: 'box',
            valign: 'center',
            className: 'system',
            children: [
                {
                    type: 'button',
                    className: 'settings',
                    onClick: () => { ags.App.toggleWindow('quicksettings'); Settings.openSettings(); },
                    tooltip: 'Settings',
                    child: {
                        type: 'icon',
                        icon: 'org.gnome.Settings-symbolic',
                    },
                },
                {
                    type: 'box',
                    className: 'uptime',
                    children: ['uptime: ', { type: 'uptime' }],
                },
                sysBtn('system-log-out-symbolic', 'Log Out'),
                sysBtn('system-shutdown-symbolic', 'Shutdown', 'shutdown'),
            ],
        },
        {
            type: 'overlay',
            className: 'battery',
            connections: [[Battery, d => {
                d.toggleClassName('half', Battery.percent < 46);
            }]],
            children: [
                { type: 'battery/progress' },
                {
                    type: 'dynamic',
                    halign: 'center',
                    items: [
                        {
                            value: true, widget: {
                                type: 'font-icon',
                                className: 'icon',
                                icon: '󱐋',
                            },
                        },
                        {
                            value: false, widget: {
                                type: 'label',
                                className: 'percent',
                                connections: [[Battery, l => {
                                    l.label = `${Battery.percent}%`;
                                }]],
                            },
                        },
                    ],
                    connections: [[Battery, d => {
                        d.update(v => v === (Battery.charging || Battery.charged));
                    }]],
                },
            ],
        },
    ],
};

const volume = {
    type: 'box',
    orientation: 'vertical',
    className: 'volume-box',
    children: [
        {
            type: 'box',
            className: 'volume',
            children: [
                {
                    type: 'button',
                    child: { type: 'audio/speaker-type-indicator' },
                    onClick: 'pactl set-sink-mute @DEFAULT_SINK@ toggle',
                },
                { className: 'slider', type: 'audio/speaker-slider', hexpand: true },
                { type: 'box', children: [{ type: 'audio/speaker-percent-label' }, '%'] },
                arrow('stream-selector'),
            ],
        },
        menu('stream-selector', {
            type: 'box',
            orientation: 'vertical',
            className: 'menu',
            children: [
                { type: 'audio/stream-selector' },
                { type: 'separator' },
                {
                    type: 'button',
                    onClick: () => {
                        execAsync('pavucontrol');
                        App.closeWindow('quicksettings');
                    },
                    child: {
                        type: 'label',
                        label: 'Settings',
                        xalign: 0,
                    },
                },
            ],
        }),
    ],
};

const brightness = {
    type: 'box',
    className: 'brightness',
    children: [
        {
            type: 'button',
            onClick: () => {
                execAsync('wl-gammactl');
                App.closeWindow('quicksettings');
            },
            child: { type: 'brightness/icon' },
        },
        { className: 'slider', type: 'brightness/slider', hexpand: true },
        { type: 'box', children: [{ type: 'brightness/percent' }, '%'] },
    ],
};

const arrowToggle = ({ icon, label, connection, toggle, name, toggleOn }) => ({
    type: 'box',
    connections: [[
        connection[0],
        w => w.toggleClassName('active', connection[1]()),
    ]],
    className: `arrow toggle ${name}`,
    children: [
        {
            type: 'button',
            hexpand: true,
            className: 'toggle',
            onClick: toggle,
            child: {
                type: 'box',
                children: [
                    { type: icon },
                    { type: label },
                ],
            },
        },
        arrow(name, toggleOn),
    ],
});

const networkToggle = arrowToggle({
    icon: 'network/wifi-indicator',
    label: 'network/ssid-label',
    connection: [Network, () => Network.wifi?.enabled],
    toggle: Network.toggleWifi,
    toggleOn: () => {
        Network.wifi.enabled = true;
        Network.wifi.scan();
    },
    name: 'network',
});

const bluetoothToggle = arrowToggle({
    icon: 'bluetooth/indicator',
    label: 'bluetooth/label',
    connection: [Bluetooth, () => Bluetooth.enabled],
    toggle: () => Bluetooth.enabled = !Bluetooth.enabled,
    toggleOn: () => Bluetooth.enabled = true,
    name: 'bluetooth',
});

const smallToggle = (toggle, indicator) => ({
    className: 'toggle',
    halign: 'fill',
    hexpand: true,
    vexpand: true,
    type: toggle,
    child: { type: indicator, halign: 'center' },
});

const dndToggle = smallToggle(
    'notifications/dnd-toggle',
    'notifications/dnd-indicator',
);

const muteToggle = smallToggle(
    'audio/microphone-mute-toggle',
    'audio/microphone-mute-indicator',
);

const darkmodeToggle = smallToggle(
    'darkmode/toggle',
    'darkmode/indicator',
);

const asusctlToggle = smallToggle(
    'asusctl/profile-toggle',
    'asusctl/profile-indicator',
);

const asusmodeToggle = smallToggle(
    'asusctl/mode-toggle',
    'asusctl/mode-indicator',
);

const appmixerToggle = {
    className: 'toggle',
    type: 'button',
    onClick: () => QSMenu.toggle('app-mixer'),
    child: { type: 'font-icon', icon: '' },
    connections: [[QSMenu, w => w.toggleClassName('on', QSMenu.opened === 'app-mixer')]],
};

const submenu = ({ menuName, icon, title, contentType }) => menu(menuName, {
    type: 'box',
    orientation: 'vertical',
    className: `submenu ${menuName}`,
    children: [
        { className: 'title', type: 'box', children: [icon, title] },
        { className: 'content', type: contentType, hexpand: true },
    ],
});

const appmixer = submenu({
    menuName: 'app-mixer',
    icon: { type: 'font-icon', icon: '' },
    title: 'App Mixer',
    contentType: 'audio/app-mixer',
});

const networkSelection = submenu({
    menuName: 'network',
    icon: { type: 'icon', icon: 'network-wireless-symbolic' },
    title: 'Wireless Networks',
    contentType: 'network/wifi-selection',
});

const bluetoothSelection = submenu({
    menuName: 'bluetooth',
    icon: { type: 'icon', icon: 'bluetooth-symbolic' },
    title: 'Bluetooth',
    contentType: 'bluetooth/devices',
});

Widget.widgets['quicksettings/popup-content'] = () => Widget({
    type: 'box',
    className: 'quicksettings',
    orientation: 'vertical',
    hexpand: false,
    children: [
        {
            type: 'box',
            className: 'header',
            children: [
                avatar,
                systemBox,
            ],
        },
        volume,
        brightness,
        {
            type: 'box',
            className: 'toggles-box',
            children: [
                {
                    type: 'box',
                    orientation: 'vertical',
                    className: 'arrow-toggles',
                    children: [networkToggle, bluetoothToggle],
                },
                {
                    type: 'box',
                    orientation: 'vertical',
                    className: 'small-toggles',
                    vexpand: true,
                    hexpand: false,
                    children: exec('which asusctl').includes('not found')
                        ? [
                            { type: 'box', children: [dndToggle, darkmodeToggle] },
                            { type: 'box', children: [appmixerToggle, muteToggle] },
                        ] : [
                            { type: 'box', children: [asusmodeToggle, asusctlToggle, darkmodeToggle] },
                            { type: 'box', children: [appmixerToggle, dndToggle, muteToggle] },
                        ],
                },
            ],
        },
        appmixer,
        networkSelection,
        bluetoothSelection,
        {
            type: 'media/popup-content',
            orientation: 'vertical',
            className: 'media',
        },
    ],
});

Widget.widgets['quicksettings/panel-button'] = () => Widget({
    type: 'button',
    className: 'quicksettings panel-button',
    onClick: () => ags.App.toggleWindow('quicksettings'),
    onScrollUp: () => {
        Audio.speaker.volume += 0.02;
        ags.Service.Indicator.speaker();
    },
    onScrollDown: () => {
        Audio.speaker.volume -= 0.02;
        ags.Service.Indicator.speaker();
    },
    connections: [[ags.App, (btn, win, visible) => {
        btn.toggleClassName('active', win === 'quicksettings' && visible);
    }]],
    child: {
        type: 'box',
        children: [
            ...(exec('which asusctl').includes('not found') ? [
                { type: 'asusctl/profile-indicator', balanced: null },
                { type: 'asusctl/mode-indicator', hybrid: null },
            ] : []),
            { type: 'audio/microphone-mute-indicator', unmuted: null },
            { type: 'notifications/dnd-indicator', noisy: null },
            {
                type: 'box',
                connections: [[Bluetooth, box => {
                    box.get_children().forEach(ch => ch.destroy());
                    for (const [, device] of Bluetooth.connectedDevices) {
                        box.add(Widget({
                            type: 'hover-revealer',
                            indicator: { type: 'icon', icon: device.iconName+'-symbolic' },
                            child: { type: 'label', label: device.name },
                        }));
                    }
                    box.show_all();
                    box.visible = Bluetooth.connectedDevices.size > 0;
                }]],
            },
            { type: 'bluetooth/indicator', disabled: null },
            { type: 'network/indicator' },
            { type: 'audio/speaker-indicator' },
            {
                type: 'hover-revealer',
                indicator: { type: 'battery/indicator', className: 'battery' },
                child: { type: 'battery/level-label' },
                connection: [Battery, revealer => {
                    revealer.reveal_child = Battery.percent < 100;
                }],
            },
        ],
    },
});
