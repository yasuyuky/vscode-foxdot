import * as vscode from "vscode";
import {
  TextEditor,
  Selection,
  StatusBarItem,
  StatusBarAlignment,
  OutputChannel
} from "vscode";
import { spawn, ChildProcess } from "child_process";

let foxDotProc: ChildProcess;
let foxDotStatus: StatusBarItem;
let foxDotOutput: OutputChannel;

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
  foxDotOutput = vscode.window.createOutputChannel("FoxDot");
  foxDotOutput.show();
  foxDotStatus = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 10);
  foxDotStatus.text = "FoxDot >>";
  foxDotStatus.command = "foxdot.record";
  foxDotStatus.show();
}

function handleOutputData(data: any) {
  foxDotOutput.appendLine(data.toString());
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
  foxDotOutput.appendLine(">>> " + sel);
  editor.selections = editor.selections.map(
    s => new Selection(s.active, s.active)
  );
}

export function deactivate() {
  stop();
}
