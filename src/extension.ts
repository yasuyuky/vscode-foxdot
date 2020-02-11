import * as vscode from "vscode";
import {
  TextEditor,
  Selection,
  StatusBarItem,
  StatusBarAlignment
} from "vscode";
import { spawn, ChildProcess } from "child_process";

let foxDotProc: ChildProcess;
let foxDotStatus: StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  let commands = new Map<string, (...args: any[]) => any>([
    ["foxdot.start", start],
    ["foxdot.sendSelection", sendSelection],
    ["foxdot.stop", stop],
    ["foxdot.restart", restart],
    ["foxdot.record", record],
    ["foxdot.stopRecording", stopRecording]
  ]);

  commands.forEach((func, key) =>
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(key, func)
    )
  );
}

function start() {
  let config = vscode.workspace.getConfiguration("foxdot");
  let command: string = config.get("pythonPath") || "python";
  foxDotProc = spawn(command, ["-m", "FoxDot", "-p"]);
  foxDotProc.stdout.on("data", handleOutputData);
  foxDotProc.stderr.on("data", handleErrorData);
  foxDotProc.on("close", handleOnClose);
  vscode.window.showInformationMessage("FoxDot has started!");
  foxDotStatus = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 10);
  foxDotStatus.text = "FoxDot >>";
  foxDotStatus.command = "foxdot.record";
  foxDotStatus.show();
}

function handleOutputData(data: any) {
  vscode.window.showInformationMessage(data.toString());
}

function handleErrorData(data: any) {
  vscode.window.showErrorMessage(data.toString());
}

function handleOnClose(code: number) {
  if (code) vscode.window.showErrorMessage(`FoxDot has exited: ${code}.`);
  else vscode.window.showInformationMessage(`FoxDot has stopped.`);
  foxDotStatus?.dispose();
}

function stop() {
  foxDotProc.kill();
}

function restart() {
  stop();
  start();
}

function record() {
  foxDotProc.stdin.write("Server.record()\n\n");
  foxDotStatus.command = "foxdot.stopRecording";
  vscode.window.showInformationMessage("Start Recording");
}

function stopRecording() {
  foxDotProc.stdin.write("Server.stopRecording()\n\n");
  foxDotStatus.command = "foxdot.record";
  vscode.window.showInformationMessage("Stop Recording");
}

function sendSelection(editor: TextEditor) {
  let sel = editor.document.getText(editor.selection);
  foxDotProc.stdin.write(sel + "\n\n");
  vscode.window.showInformationMessage(">>> " + sel);
  editor.selections = editor.selections.map(
    s => new Selection(s.active, s.active)
  );
}

export function deactivate() {
  stop();
}
