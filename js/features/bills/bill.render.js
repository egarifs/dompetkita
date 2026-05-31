window.AppBillReminderRender = {
  createRenderer({ appIcon, editIcon, escapeHtml, money, service, trashIcon }) {
    function rows(limit = null) {
      const reminders = service.sorted().slice(0, limit ?? service.sorted().length);
      if (!reminders.length) {
        return `
          <div class="empty">
            <p>Belum ada reminder tagihan.</p>
            <button class="button primary" type="button" data-open-form="billReminder">Tambah Tagihan</button>
          </div>
        `;
      }

      return reminders.map((item) => {
        const status = service.status(item);
        return `
          <article class="bill-card bill-card-${status}">
            <div class="bill-card-icon" aria-hidden="true">${appIcon(status === "paid" ? "circle-check" : "receipt-text", 21)}</div>
            <div class="bill-card-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.note || item.category || "Tagihan")}</span>
            </div>
            <div class="bill-card-value">
              <strong>${money(item.amount)}</strong>
              <span class="bill-status bill-status-${status}">${escapeHtml(service.dueLabel(item))}</span>
            </div>
            <div class="bill-card-actions">
              <button class="button" type="button" data-toggle-bill="${item.id}">${item.status === "paid" ? "Batal Terbayar" : "Tandai Terbayar"}</button>
              <button class="icon-button" type="button" title="Edit tagihan" data-edit-bill="${item.id}">${editIcon()}</button>
              <button class="icon-button danger" type="button" title="Hapus tagihan" data-delete-bill="${item.id}">${trashIcon()}</button>
            </div>
          </article>
        `;
      }).join("");
    }

    function render() {
      const summary = service.summary();
      const reminders = service.sorted();
      const homeSummary = document.querySelector("#billReminderSummary");
      if (homeSummary) {
        homeSummary.textContent = reminders.length
          ? `${reminders.filter((item) => item.status !== "paid").length} tagihan belum lunas.`
          : "Belum ada tagihan.";
      }
      document.querySelector("#billReminderList").innerHTML = rows(5);
      document.querySelector("#billReminderTotalUnpaid").textContent = money(summary.totalUnpaid);
      document.querySelector("#billReminderDueThisMonth").textContent = `${summary.dueThisMonth} tagihan akan jatuh tempo bulan ini`;
      document.querySelector("#billReminderPageList").innerHTML = rows();
    }

    return {
      render,
      rows,
    };
  },
};
