
export class SecurityHandlebarsStuff {

	static init() {
		this.loadTemplates();
	}

	static loadTemplates() {
		const paths = [
			"module/gm-paranoia-taragnor/hbs/changelog-subtable.hbs",
		];
		loadTemplates(paths);
	}

}
