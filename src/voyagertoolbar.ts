import path = require("path");

import {
  ActivityMonitor,
  PathExt,
  ISettingRegistry
} from "@jupyterlab/coreutils";

import {
  Toolbar,
  ToolbarButton,
  Clipboard,
  Dialog,
  showDialog,
  showErrorMessage
} from "@jupyterlab/apputils";

import {
  DocumentWidget,
  Context,
  DocumentRegistry
} from "@jupyterlab/docregistry";

import { Widget, BoxLayout } from "@phosphor/widgets";

import { Message } from "@phosphor/messaging";

import { IDocumentManager, DocumentManager } from "@jupyterlab/docmanager";

import { ISignal, Signal } from "@phosphor/signaling";

import { CreateVoyager, Voyager } from "datavoyager/build/lib-voyager";
import { VoyagerConfig } from "datavoyager/build/models/config";
import "datavoyager/build/style.css";
import { read } from "vega-loader";

import { PromiseDelegate } from "@phosphor/coreutils";

import {
  VoyagerPanel,
  JUPYTER_CELL_MIME,
  isValidFileName,
  Voyager_CLASS
} from "./voyagerpanel";

import { JupyterLab } from "@jupyterlab/application";
import "../style/index.css";

const VOYAGER_PANEL_TOOLBAR_CLASS = "jp-VoyagerPanel-toolbar";

/**
 * The class name added to toolbar save button.
 */
const TOOLBAR_SAVE_CLASS = "jp-SaveIcon";

/**
 * The class name added to toolbar insert button.
 */
const TOOLBAR_EXPORT_CLASS = "jp-ExportIcon";

/**
 * The class name added to toolbar insert button.
 */
const TOOLBAR_COPY_CLASS = "jp-CopyIcon";

/**
 * The class name added to toolbar cut button.
 */
const TOOLBAR_UNDO_CLASS = "jp-UndoIcon";

/**
 * The class name added to toolbar copy button.
 */
const TOOLBAR_REDO_CLASS = "jp-RedoIcon";

// dont need class for now
export namespace VoyagerToolbar {
  export function setupToolbar(
    toolbar: Toolbar,
    panel: VoyagerPanel,
    app: JupyterLab,
    docManager: IDocumentManager
  ) {
    toolbar.addClass(VOYAGER_PANEL_TOOLBAR_CLASS);
    toolbar.addItem("save", Private.createSaveButton(panel));
    toolbar.addItem(
      "saveAs",
      Private.createExportButton(panel, app, docManager)
    );
    toolbar.addItem(
      "ExportToNotebook",
      Private.createCopyButton(panel, app, docManager)
    );
    toolbar.addItem("undo", Private.createUndoButton(panel));
    toolbar.addItem("redo", Private.createRedoButton(panel));
  }
}

namespace Private {
  export function createSaveButton(widget: VoyagerPanel): ToolbarButton {
    return new ToolbarButton({
      className: TOOLBAR_SAVE_CLASS,
      onClick: () => {
        if (
          widget &&
          widget.hasClass(Voyager_CLASS) &&
          (widget as VoyagerPanel).context.path.indexOf("vl.json") !== -1
        ) {
          var datavoyager = (widget as VoyagerPanel).voyager_cur;
          var dataSrc = (widget as VoyagerPanel).data_src;
          let spec = datavoyager.getSpec(false);
          let context = widget.context as Context<DocumentRegistry.IModel>;
          context.model.fromJSON({
            data: dataSrc,
            mark: spec.mark,
            encoding: spec.encoding,
            height: spec.height,
            width: spec.width,
            description: spec.description,
            name: spec.name,
            selection: spec.selection,
            title: spec.title,
            transform: spec.transform
          });
          context.save();
        } else {
          showDialog({
            title: "Source File Type is NOT Vega-Lite (.vl.json)",
            body: "To save this chart, use 'Export Voyager as Vega-Lite file' ",
            buttons: [Dialog.warnButton({ label: "OK" })]
          });
        }
      },
      tooltip: "Save Voyager"
    });
  }

  export function createExportButton(
    widget: VoyagerPanel,
    app: JupyterLab,
    docManager: DocumentManager
  ): ToolbarButton {
    return new ToolbarButton({
      className: TOOLBAR_EXPORT_CLASS,
      onClick: () => {
        var datavoyager = (widget as VoyagerPanel).voyager_cur;
        var dataSrc = (widget as VoyagerPanel).data_src;
        //let aps = datavoyager.getApplicationState();
        let spec = datavoyager.getSpec(false);
        //let context = docManager.contextForWidget(widget) as Context<DocumentRegistry.IModel>;
        let context = widget.context as Context<DocumentRegistry.IModel>;
        let path = PathExt.dirname(context.path);
        var content: any;
        if (spec !== undefined) {
          content = {
            data: dataSrc,
            mark: spec.mark,
            encoding: spec.encoding,
            height: spec.height,
            width: spec.width,
            description: spec.description,
            name: spec.name,
            selection: spec.selection,
            title: spec.title,
            transform: spec.transform
          };
        } else {
          content = {
            data: dataSrc
          };
        }
        let input_block = document.createElement("div");
        let input_prompt = document.createElement("div");
        input_prompt.textContent = "";
        let input = document.createElement("input");
        input_block.appendChild(input_prompt);
        input_block.appendChild(input);
        let bd = new Widget({ node: input_block });
        showDialog({
          title: "Export as Vega-Lite File (.vl.json)",
          body: bd,
          buttons: [Dialog.cancelButton(), Dialog.okButton({ label: "OK" })]
        }).then(result => {
          let msg = input.value;
          if (result.button.accept) {
            if (!isValidFileName(msg)) {
              showErrorMessage(
                "Name Error",
                Error(
                  `"${result.value}" is not a valid name for a file. ` +
                    `Names must have nonzero length, ` +
                    `and cannot include "/", "\\", or ":"`
                )
              );
            } else {
              let basePath = path;
              let newPath = PathExt.join(
                basePath,
                msg.indexOf(".vl.json") !== -1 ? msg : msg + ".vl.json"
              );
              app.commands
                .execute("docmanager:new-untitled", {
                  path: basePath,
                  ext: ".vl.json",
                  type: "file"
                })
                .then(model => {
                  docManager.rename(model.path, newPath).then(model => {
                    app.commands
                      .execute("docmanager:open", {
                        path: model.path,
                        factory: "Editor"
                      })
                      .then(widget => {
                        let context = docManager.contextForWidget(widget);
                        if (context != undefined) {
                          context.save().then(() => {
                            if (context != undefined) {
                              context.model.fromJSON(content);
                              context.save();
                            }
                          });
                        }
                      });
                  });
                });
            }
          }
        });
      },
      tooltip: "Export Voyager as Vega-Lite File"
    });
  }

  export function createCopyButton(
    widget: VoyagerPanel,
    app: JupyterLab,
    docManager: DocumentManager
  ): ToolbarButton {
    return new ToolbarButton({
      className: TOOLBAR_COPY_CLASS,
      onClick: () => {
        var datavoyager = widget.voyager_cur;
        var dataSrc = widget.data_src;
        let spec = datavoyager.getSpec(false);
        let src = JSON.stringify({
          data: dataSrc,
          mark: spec.mark,
          encoding: spec.encoding,
          height: spec.height,
          width: spec.width,
          description: spec.description,
          name: spec.name,
          selection: spec.selection,
          title: spec.title,
          transform: spec.transform
        });
        let clipboard = Clipboard.getInstance();
        clipboard.clear();
        let data = [
          {
            cell_type: "code",
            execution_count: null,
            metadata: {},
            outputs: [],
            source: [
              "import altair as alt\n",
              "import pandas as pd\n",
              "import json\n",
              `data_src = json.loads('''${src}''')\n`,
              "alt.Chart.from_dict(data_src)\n"
            ]
          }
        ];
        clipboard.setData(JUPYTER_CELL_MIME, data);
      },
      tooltip: "Copy Altair Graph to clipboard"
    });
  }

  export function createUndoButton(widget: VoyagerPanel): ToolbarButton {
    return new ToolbarButton({
      className: TOOLBAR_UNDO_CLASS,
      onClick: () => {
        (widget as VoyagerPanel).voyager_cur.undo();
      },
      tooltip: "Undo"
    });
  }

  export function createRedoButton(widget: VoyagerPanel): ToolbarButton {
    return new ToolbarButton({
      className: TOOLBAR_REDO_CLASS,
      onClick: () => {
        (widget as VoyagerPanel).voyager_cur.redo();
      },
      tooltip: "Redo"
    });
  }

  export function isValidURL(str: string) {
    var a = document.createElement("a");
    a.href = str;
    return a.host && a.host != window.location.host;
  }
}
