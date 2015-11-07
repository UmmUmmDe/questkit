exports.generate = function (inputFilename, sourcePath, options) {
    var compiler = new Compiler();
    return compiler.generate(inputFilename, sourcePath, options);
};

exports.getJs = function (inputFile, sourcePath, options) {
    var compiler = new Compiler();
    var result = compiler.process(inputFile, null, sourcePath, options);
    return result.js;
};

var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');

var packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')).toString());
var questKitVersion = packageJson.version;

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
};

function Compiler() {
    this.language = {};

    this.process = function (inputFile, inputPath, sourcePath, options) {
        this.language = yaml.safeLoad(fs.readFileSync(path.join(sourcePath, 'en.yaml')));
        var settings = null;

        var sections = [];
        var storyJs = typeof options.scriptonly === 'string' ? options.scriptonly : 'story.js';

        var coreYaml = fs.readFileSync(this.findFile('core.yaml', inputPath, sourcePath), 'utf8');

        this.processFile(sections, inputFile, true);
        this.processFile(sections, coreYaml, false);

        console.log('Loaded {0} sections'.format(sections.length));
        console.log('Writing ' + storyJs);

        var coreJsFiles = [
            'core.js',
            'core.scopes.js',
            'core.parser.js',
            'core.descriptions.js',
            'core.commands.js',
            'en.js',
        ];

        var coreJs = coreJsFiles.map(function (file) {
            return fs.readFileSync(path.join(sourcePath, file)).toString();
        }).join('');

        var startJs = options.cli ? '(function () {' : '(function ($) {';

        var coreJsFile = fs.readFileSync(path.join(sourcePath, 'core.js'));
        var uiJsFile = fs.readFileSync(path.join(sourcePath, options.cli ? 'cli.js' : 'ui.js')).toString();

        if (options.scriptonly && options.pluginname) {
            uiJsFile = uiJsFile.replace('$.fn.questkit =', '$.fn.' + options.pluginname + ' =');
        }

        var jsData = '// Created with QuestKit {0}\n// https://github.com/textadventures/questkit\n\n'
            .format(questKitVersion) +
            startJs + '\n' +
            coreJs + '\n' +
            uiJsFile;

        var outputJsFile = [];
        outputJsFile.push(jsData);
        outputJsFile.push('\n\n');

        var game = sections.shift();

        if (!game.pov) {
            game.pov = 'player';

            // If a player object doesn't exist already, create it in the first location

            var player = null;
            var firstLocation;

            sections.forEach(function (section) {
                if (section['~name'] == 'player') {
                    player = section;
                    return;
                }

                if (!firstLocation && section['~type'] == 'location') {
                    firstLocation = section['~name'];
                }

                if (section['~name'] === 'settings') {
                    settings = section;
                }
            });

            if (!player) {
                player = {
                    '~name': 'player',
                    '~type': 'object',
                    parent: firstLocation
                };
                sections.push(player);
            }

            if (!player.look) player.look = this.language.defaults.DefaultSelfDescription;
            if (!player.povalias) player.povalias = this.language.defaults.SelfAlias;
            if (!player.povalt) player.povalt = this.language.defaults.SelfAlt;
        }

        Object.keys(game).forEach(function (attr) {
            outputJsFile.push('set(\'{0}\', {1});\n'.format(attr, JSON.stringify(game[attr])));
        });

        sections.forEach(function (section) {
            outputJsFile.push('\n');
            this.writeSection(outputJsFile, section);
        }, this);

        outputJsFile.push('\n');
        outputJsFile.push('initData.templates = ' + JSON.stringify(this.language.defaults, null, '\t') + ';\n');
        outputJsFile.push('questkit.ready = function () { questkit.init(initData); };\n');

        if (options.cli) {
            outputJsFile.push('questkit.ready();');
            outputJsFile.push('})();');
        }
        else {
            outputJsFile.push('}(jQuery));');
        }

        return {
            jsFilename: storyJs,
            js: outputJsFile.join(''),
            game: game,
        };
    };

    this.generate = function (inputFilename, sourcePath, options) {
        var outputPath = path.resolve(path.dirname(inputFilename));
        var inputFile = fs.readFileSync(path.resolve(inputFilename), 'utf8');

        var result = this.process(inputFile, outputPath, sourcePath, options);

        fs.writeFileSync(path.join(outputPath, result.jsFilename), result.js);

        if (!options.cli && !options.scriptonly) {
            console.log('Writing index.html');

            var htmlTemplateFile = fs.readFileSync(this.findFile('index.template.html', outputPath, sourcePath));
            var htmlData = htmlTemplateFile.toString();
            htmlData = htmlData.replace('<!-- INFO -->', '<!--\n\nCreated with QuestKit {0}\n\n\nhttps://github.com/marksill/questkit\n\n-->'.format(questKitVersion));
            htmlData = htmlData.replace(/<!-- TITLE -->/g, result.game.title);
            fs.writeFileSync(path.join(outputPath, 'index.html'), htmlData);

            console.log('Copying jquery');
            fs.createReadStream(path.join(sourcePath, 'node_modules', 'jquery', 'dist', 'jquery.min.js')).pipe(fs.createWriteStream(path.join(outputPath, 'jquery.min.js')));

            console.log('Copying bootstrap');
            fs.createReadStream(path.join(sourcePath, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css')).pipe(fs.createWriteStream(path.join(outputPath, 'bootstrap.min.css')));
            fs.createReadStream(path.join(sourcePath, 'node_modules', 'bootstrap', 'dist', 'js', 'bootstrap.min.js')).pipe(fs.createWriteStream(path.join(outputPath, 'bootstrap.min.js')));

            console.log('Writing style.css');

            var cssTemplateFile = fs.readFileSync(this.findFile('style.template.css', outputPath, sourcePath));
            var cssData = cssTemplateFile.toString();
            fs.writeFileSync(path.join(outputPath, 'style.css'), cssData);
        }

        console.log('Done.');

        return outputPath;
    };

    this.processFile = function (sections, file, isFirst) {
        var compiler = this;

        var defaultParent;
        var count = 0;

        var docs = yaml.safeLoadAll(file, function (section) {
            sections.push(section);

            // If any attribute has a sub-attribute 'template', replace it with the value from the loaded language file

            Object.keys(section).forEach(function (attr) {
                if (section[attr] && section[attr].template) {
                    section[attr] = compiler.language[section[attr].template];
                }
            });

            if (++count == 1 && isFirst) {
                // no further processing for the game data at the top of the first file
                return;
            }

            var type = Object.keys(section)[0];
            if (!(type in compiler.sectionTypes)) {
                throw 'Unknown type - {0}: {1}'.format(type, section[type]);
            }

            var name = section[type];
            if (!name) name = '~' + compiler.anonymousCount++;

            if (type == "settings") {
                /*sections.push({
                    '~name': "~" + compiler.anonymousCount++,
                    parent: name
                });*/
            }

            if (type == 'location') {
                // set default parent to this for subsequent objects, exits etc.
                defaultParent = name;

                // convert any directional attributes into exits
                Object.keys(compiler.directions).forEach(function (direction) {
                    if (!(direction in section)) return;

                    // create the exit
                    sections.push({
                        '~name': '~' + compiler.anonymousCount++,
                        '~type': 'exit',
                        parent: name,
                        direction: direction,
                        alias: direction,
                        to: section[direction]
                    });

                    // and the exit in the opposite direction
                    sections.push({
                        '~name': '~' + compiler.anonymousCount++,
                        '~type': 'exit',
                        parent: section[direction],
                        direction: compiler.directions[direction],
                        alias: compiler.directions[direction],
                        to: name
                    });

                    delete section[direction];
                });
            }

            if (type == 'exit') {
                if (!section.alias) section.alias = section.direction || section.to;
            }

            if (type !== 'location' && type != 'walkthrough') {
                if (defaultParent && !section.parent && type != 'walkthrough') section.parent = defaultParent;
            }

            section['~type'] = type;
            section['~name'] = name;
        });
    };

    this.findFile = function (filename, outputPath, sourcePath) {
        if (outputPath) {
            var outputPathFile = path.join(outputPath, filename);
            if (fs.existsSync(outputPathFile)) {
                return outputPathFile;
            }
        }
        return path.join(sourcePath, filename);
    };

    // section types and the initData list they live in

    this.sectionTypes = {
        'command': 'commands',
        'location': 'objects',
        'object': 'objects',
        'character': 'objects',
        'exit': 'exits',
        'walkthrough': 'walkthroughs',
        //'settings': 'settings'
    };

    // directions and their opposites

    this.directions = {
        'north': 'south',
        'east': 'west',
        'south': 'north',
        'west': 'east',
        'northeast': 'southwest',
        'southeast': 'northwest',
        'southwest': 'northeast',
        'northwest': 'southeast',
        'up': 'down',
        'down': 'up',
        'in': 'out',
        'out': 'in',
    };

    this.anonymousCount = 0;

    this.writeSection = function (outputJsFile, section) {
        var type = section['~type'];
        var name = section['~name'];
        outputJsFile.push('initData.{0}.push(\'{1}\');\n'.format(this.sectionTypes[type], name));

        if (type === "settings") {

        } else if (type == 'command') {
            var patterns = [];
            if (!section.patterns) section.patterns = [];
            if (section.pattern) {
                section.patterns.push(section.pattern);
                delete section.pattern;
            }
            var variablesRegex = /\#(.*?)\#/g;
            var groups = [];
            var match;
            while (!!(match = variablesRegex.exec(section.patterns[0]))) {
                groups.push(match[1]);
            }
            section.patterns.forEach(function (pattern) {
                pattern = pattern.replace(/\(/g, '\\(');
                pattern = pattern.replace(/\)/g, '\\)');
                pattern = pattern.replace(/\./g, '\\.');
                pattern = pattern.replace(/\?/g, '\\?');
                pattern = pattern.replace(variablesRegex, '(.*?)');
                patterns.push('/^' + pattern + '$/');
            });
            delete section.patterns;

            outputJsFile.push('initData.regexes[\'{0}\'] = {\n'.format(name));
            outputJsFile.push('\tpatterns: [{0}],\n'.format(patterns.join(', ')));
            outputJsFile.push('\tgroups: {0}\n'.format(JSON.stringify(groups)));
            outputJsFile.push('};\n');

            if (section.action && section.action.script) {
                outputJsFile.push('initData.scripts[\'{0}.action\'] = function ({1}) {\n'.format(name, groups.join(', ')));
                this.writeJs(outputJsFile, 1, section.action.script);
                outputJsFile.push('};\n');

                delete section.action;
            }
        }

        if (type == 'walkthrough') {
            for (var i = 0; i < section.steps.length; i++) {
                var step = section.steps[i];
                if (step.assert) {
                    outputJsFile.push('initData.scripts[\'{0}.{1}\'] = function () {\n'.format(name, i));
                    this.writeJs(outputJsFile, 1, 'return ' + step.assert + ';');
                    outputJsFile.push('};\n');
                    step.script = '{0}.{1}'.format(name, i);
                }
            }
        }

        var attrs = Object.keys(section).slice(0);
        attrs.shift();
        attrs.forEach(function (attr) {
            if (attr.indexOf('~') === 0) return;
            if (section[attr].script) {
                outputJsFile.push('initData.scripts[\'{0}.{1}\'] = function () {\n'.format(name, attr));
                this.writeJs(outputJsFile, 1, section[attr].script);
                outputJsFile.push('};\n');
            }
            else {
                outputJsFile.push('set(\'{0}.{1}\', {2});\n'.format(name, attr, JSON.stringify(section[attr])));
            }
        }, this);
    };

    this.writeJs = function (outputJsFile, tabCount, js) {
        var tabs = new Array(tabCount).join('\t');
        var lines = js.trim().replace(/\r/g, '').split('\n');
        lines.forEach(function (jsLine) {
            outputJsFile.push('{0}\t{1}\n'.format(tabs, jsLine));
        });
    };
}
