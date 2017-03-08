define([
    'jquery',
    'base/js/dialog',
    'base/js/events',
    'base/js/namespace',
    'notebook/js/celltoolbar',
    'notebook/js/codecell',
], function (
    $,
    dialog,
    events,
    Jupyter,
    celltoolbar,
    codecell
) {
    "use strict";

    var CellToolbar = celltoolbar.CellToolbar;

    var mod_name = 'init_cell';
    var log_prefix = '[' + mod_name + ']';
    var options = { // updated from server's config on loading nbextension
        run_on_kernel_ready: true,
    };

    var init_cell_ui_callback = CellToolbar.utils.checkbox_ui_generator(
        'Initialisation Cell',
        // setter
        function (cell, value) {
            cell.metadata.init_cell = value;
        },
        // getter
        function (cell) {
             // if init_cell is undefined, it'll be interpreted as false anyway
            return cell.metadata.init_cell;
        }
    );

    function run_init_cells () {
        console.log(log_prefix, 'running all initialization cells');
        var num = 0;
        var cells = Jupyter.notebook.get_cells();
        for (var ii = 0; ii < cells.length; ii++) {
            var cell = cells[ii];
            if ((cell instanceof codecell.CodeCell) && cell.metadata.init_cell === true ) {
                cell.execute();
                num++;
            }
        }
        console.log(log_prefix, 'finished running ' + num + ' initialization cell' + (num !== 1 ? 's' : ''));
    }

    var load_ipython_extension = function() {
        // register action
        var prefix = 'auto';
        var action_name = 'run-initialization-cells';
        var action = {
            icon: 'fa-calculator',
            help: 'Run all initialization cells',
            help_index : 'zz',
            handler : run_init_cells
        };
        var action_full_name = Jupyter.notebook.keyboard_manager.actions.register(action, action_name, prefix);

        // add toolbar button
        Jupyter.toolbar.add_buttons_group([action_full_name]);

        // Register a callback to create a UI element for a cell toolbar.
        CellToolbar.register_callback('init_cell.is_init_cell', init_cell_ui_callback, 'code');
        // Register a preset of UI elements forming a cell toolbar.
        CellToolbar.register_preset('Initialisation Cell', ['init_cell.is_init_cell']);

        Jupyter.notebook.config.loaded()
            .then(function update_options_from_config () {
                $.extend(true, options, Jupyter.notebook.config[mod_name]);
                    // update from metadata
                    return new Promise(function (resolve, reject) {
                        function update_options_from_nb_metadata () {
                            var md_opts = Jupyter.notebook.metadata.init_cell;
                            if (md_opts !== undefined) {
                                console.log(log_prefix, 'updating options from notebook metadata:', md_opts);
                                $.extend(true, options, md_opts);
                            }
                            resolve(options);
                        }
                        if (Jupyter.notebook) {
                            update_options_from_nb_metadata();
                        }
                        else {
                            events.on('notebook_loaded.Notebook', update_options_from_nb_metadata);
                        }
                    });
            }, function (reason) {
                console.warn(log_prefix, 'error loading config:', reason);
                })
            .then(function () {
                function init_cells_after_notebook_loaded(){
                    if (options.run_on_kernel_ready) {
                        if (!Jupyter.notebook.trusted) {
                            dialog.modal({
                                title : 'Initialization cells in untrusted notebook',
                                body : 'This notebook is not trusted, so initialization cells will not be automatically run on kernel load. You can still run them manually, though.',
                                buttons: {'OK': {'class' : 'btn-primary'}},
                                notebook: Jupyter.notebook,
                                keyboard_manager: Jupyter.keyboard_manager,
                            });
                            return;
                        }

                        if (Jupyter.notebook && Jupyter.notebook.kernel && Jupyter.notebook.kernel.info_reply.status === 'ok') {
                            // kernel is already ready
                            run_init_cells();
                        }
                        // whenever a (new) kernel  becomes ready, run all initialization cells
                        events.on('kernel_ready.Kernel', run_init_cells);
                    }
                }
                if(Jupyter.notebook._fully_loaded){
                    init_cells_after_notebook_loaded();
                }
                else{
                    events.on('notebook_loaded.Notebook', init_cells_after_notebook_loaded);
                }
            }).catch(function (reason) {
                console.error(log_prefix, 'unhandled error:', reason);
            });
    };

    return {
        load_ipython_extension : load_ipython_extension
    };
});
