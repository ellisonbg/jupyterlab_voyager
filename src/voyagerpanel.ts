///<reference path="./lib.d.ts"/>

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

import "../style/index.css";
import { VoyagerToolbar } from "./voyagertoolbar";
import { JupyterLab } from "@jupyterlab/application";

/**
 * The mimetype used for Jupyter cell data.
 */
export const JUPYTER_CELL_MIME = "application/vnd.jupyter.cells";

/**
 * The class name added to a datavoyager widget.
 */
export const Voyager_CLASS = "jp-Voyager";

export class VoyagerPanel extends DocumentWidget<Widget> {
  public voyager_cur!: Voyager;
  public data_src: any;
  public fileType: String;

  constructor(
    options: DocumentWidget.IOptions<Widget>,
    app: JupyterLab,
    docManager: IDocumentManager,
    df = false,
    isTable?: boolean,
    data?: any,
    fileName?: string,
    context?: Context<DocumentRegistry.IModel>
  ) {
    super({ ...options, content: new Widget() });
    this.addClass(Voyager_CLASS);

    this.fileType = df
      ? "tempory"
      : PathExt.extname(this.context.localPath).substring(1);

    if (!df) {
      this.title.label = PathExt.basename(this.context.path);
      this.context.model.contentChanged.connect(
        this.update,
        this
      );
      this.context.fileChanged.connect(
        this.update,
        this
      );
    }

    this.context.ready.then(() => {
      if (df) {
        if (isTable) {
          this.voyager_cur = CreateVoyager(
            this.content.node,
            Private.VoyagerConfig as VoyagerConfig,
            data
          );
        } else {
          var DATA = data["data"];
          this.data_src = DATA;
          if (DATA["url"]) {
            if (!Private.isValidURL(DATA["url"])) {
              let basePath = PathExt.dirname(this.context.localPath);
              let filePath = PathExt.basename(DATA["url"]);
              let wholePath = path.join(basePath, filePath);

              docManager.services.contents.get(wholePath).then(src => {
                let local_filetype = PathExt.extname(DATA["url"]).substring(1);
                let local_values = read(src.content, { type: local_filetype });
                this.voyager_cur = CreateVoyager(
                  this.content.node,
                  Private.VoyagerConfig as VoyagerConfig,
                  { values: local_values }
                );
              });
            } else {
              this.voyager_cur = CreateVoyager(
                this.content.node,
                Private.VoyagerConfig as VoyagerConfig,
                data["data"]
              );
            }
          } else if (DATA["values"]) {
            //check if it's array value data source
            this.voyager_cur = CreateVoyager(
              this.content.node,
              Private.VoyagerConfig as VoyagerConfig,
              data["data"]
            );
          } else {
            //other conditions, just try to pass the value to voyager and wish the best
            this.voyager_cur = CreateVoyager(
              this.content.node,
              Private.VoyagerConfig as VoyagerConfig,
              data["data"]
            );
          }
          this.voyager_cur.setSpec({
            mark: data["mark"],
            encoding: data["encoding"],
            height: data["height"],
            width: data["width"],
            description: data["description"],
            name: data["name"],
            selection: data["selection"],
            title: data["title"],
            transform: data["transform"]
          });
        }
        this.title.label = fileName || "";
      } else {
        const data = this.context.model.toString();
        var values: any;
        if (this.fileType === "txt") {
          values = read(data, { type: "json" });
        } else {
          values = read(data, { type: this.fileType });
        }
        if (this.fileType === "json" || this.fileType === "txt") {
          if (values["data"]) {
            var DATA = values["data"];
            this.data_src = DATA;
            if (DATA["url"]) {
              //check if it's url type datasource
              if (!Private.isValidURL(DATA["url"])) {
                let basePath = PathExt.dirname(this.context.localPath);
                let wholePath = path.join(basePath, DATA["url"]);
                docManager.services.contents.get(wholePath).then(src => {
                  let local_filetype = PathExt.extname(DATA["url"]).substring(
                    1
                  );
                  let local_values = read(src.content, {
                    type: local_filetype
                  });
                  this.voyager_cur = CreateVoyager(
                    this.content.node,
                    Private.VoyagerConfig as VoyagerConfig,
                    { values: local_values }
                  );
                  this.voyager_cur.setSpec({
                    mark: values["mark"],
                    encoding: values["encoding"],
                    height: values["height"],
                    width: values["width"],
                    description: values["description"],
                    name: values["name"],
                    selection: values["selection"],
                    title: values["title"],
                    transform: values["transform"]
                  });
                });
              } else {
                this.voyager_cur = CreateVoyager(
                  this.content.node,
                  Private.VoyagerConfig as VoyagerConfig,
                  values["data"]
                );
              }
            } else if (DATA["values"]) {
              //check if it's array value data source
              this.voyager_cur = CreateVoyager(
                this.content.node,
                Private.VoyagerConfig as VoyagerConfig,
                values["data"]
              );
            } else {
              //other conditions, just try to pass the value to voyager and wish the best
              this.voyager_cur = CreateVoyager(
                this.content.node,
                Private.VoyagerConfig as VoyagerConfig,
                values["data"]
              );
              this.data_src = values["data"];
            }
          } else {
            //other conditions, just try to pass the value to voyager and wish the best
            this.voyager_cur = CreateVoyager(
              this.content.node,
              Private.VoyagerConfig as VoyagerConfig,
              { values }
            );
            this.data_src = { values };
          }

          //update the specs if possible
          this.voyager_cur.setSpec({
            mark: values["mark"],
            encoding: values["encoding"],
            height: values["height"],
            width: values["width"],
            description: values["description"],
            name: values["name"],
            selection: values["selection"],
            title: values["title"],
            transform: values["transform"]
          });
        } else {
          this.voyager_cur = CreateVoyager(
            this.content.node,
            Private.VoyagerConfig as VoyagerConfig,
            { values }
          );
          this.data_src = { values };
        }
      }
    });

    // Toolbar
    VoyagerToolbar.setupToolbar(this.toolbar, this, app, docManager);
  }

  /**
   * The plugin settings.
   */
  get settings(): ISettingRegistry.ISettings | null {
    return this._settings;
  }

  set settings(settings: ISettingRegistry.ISettings | null) {
    if (this._settings) {
      this._settings.changed.disconnect(this._onSettingsChanged, this);
    }
    this._settings = settings;
    if (this._settings) {
      this._settings.changed.connect(
        this._onSettingsChanged,
        this
      );
    }
    this.update();
  }
  /**
   * Handle setting changes.
   */
  private _onSettingsChanged(): void {
    this.update();
  }

  private _settings: ISettingRegistry.ISettings | null = null;

  /**
   * A signal that emits when editor layout state changes and needs to be saved.
   */
  get stateChanged(): ISignal<this, void> {
    return this._stateChanged;
  }

  /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.content.node.tabIndex = -1;
    this.content.node.focus();
  }

  private _stateChanged = new Signal<this, void>(this);
}

export function isValidFileName(name: string): boolean {
  const validNameExp = /[\/\\:]/;
  return name.length > 0 && !validNameExp.test(name);
}

namespace Private {
  export const VoyagerConfig = {
    // don't allow user to select another data source from Voyager UI
    showDataSourceSelector: false,
    serverUrl: null,
    hideHeader: true,
    hideFooter: true,
    relatedViews: "initiallyCollapsed",
    wildcards: "enabled"
  };

  export function isValidURL(str: string) {
    var a = document.createElement("a");
    a.href = str;
    return a.host && a.host != window.location.host;
  }
}
