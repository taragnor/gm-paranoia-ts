import { } from "./roller-patch.js";
import {DiceSecurity} from "./diceSecurity.js";
import {ChangeLogger} from "./dataSecurity.js";
import {SecuritySettings} from "./security-settings.js";
import {SecurityHandlebarsStuff} from "./handlebars-stuff.js";
import {ChangelogDialog} from "./changelog-dialog.js";

import {Sockets} from "./foundry-tools.js";

Hooks.on("ready",  () => {
	//DEBUG
	//@ts-ignore
	window.ChangelogDialog = ChangelogDialog;
	Sockets.init("gm-paranoia-taragnor");
	SecurityHandlebarsStuff.init();
	SecuritySettings.init();
	if (SecuritySettings.monitorDiceRolls())
		DiceSecurity.SecurityInit();
	if (SecuritySettings.monitorChanges())
		ChangeLogger.init();
});


