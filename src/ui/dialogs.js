import $ from "jquery";

export class Dialogs {
  constructor(reset, info, {pause, resume}) {
    this.resetDialog = reset;
    this.infoDialog = info;
    this.pause = pause;
    this.resume = resume;
  }

  get paused() { return this.resetDialog.open || this.infoDialog.open; }

  open(dialog) {
    dialog.returnValue = "";
    this.pause();
    return new Promise(resolve => {
      $(dialog).one("close", () => {
        this.resume();
        resolve(dialog.returnValue);
      });
      dialog.showModal();
    });
  }

  async confirmReset({currentBudget, nextBudget, baseMoves, paintCount}) {
    const $choice = $(this.resetDialog).find(".bonus-choice");
    const $checkbox = $choice.find("input");
    const canIncrease = nextBudget > currentBudget;
    $choice.prop("hidden", !canIncrease);
    $checkbox.prop("checked", true);
    $choice.find("span").text("使用原版奖励步数：基础" + baseMoves + " + 奖励" +
      (nextBudget - baseMoves) + " = " + nextBudget + "步（本盘累计染色" + paintCount + "次）");
    if (await this.open(this.resetDialog) !== "reset") return null;
    return {claimBonus: !canIncrease || $checkbox.prop("checked")};
  }

  showInfo(kind) {
    const help = kind === "help";
    $(this.infoDialog).find("h2").text(help ? "溢彩画" : "绘制已暂停");
    $(this.infoDialog).find("#info-help").prop("hidden", !help);
    $(this.infoDialog).find("#info-pause").prop("hidden", help);
    return this.open(this.infoDialog);
  }
}
