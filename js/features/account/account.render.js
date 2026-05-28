window.AppAccountRender = {
  createRenderer(deps) {
    const {
      appVersion,
      cloudSync,
      currentLanguage,
      dashboardSectionLabel,
      escapeHtml,
      getCategories,
      getCurrentUser,
      getState,
      isAdmin,
      isChildUser,
      isCloudSyncAllowed,
      isGuest,
      money,
      syncStatusText,
    } = deps;

    function renderFamilyMembers() {
      const state = getState();
      const target = document.querySelector("#familyMemberList");
      if (!target) return;
      if (isChildUser()) {
        target.innerHTML = `<div class="empty"><p>Akun child memiliki akses baca ke data keluarga dan tidak bisa mengelola anggota.</p></div>`;
        return;
      }
      const members = state.familyMembers || [];
      target.innerHTML = members.length
        ? members.map((member) => `
          <article class="debt-item">
            <div>
              <div class="debt-row-top">
                <strong>${escapeHtml(member.childName || member.childEmail)}</strong>
                <span class="pill ${member.status === "active" ? "income" : "debt"}">${member.status === "active" ? "Aktif" : "Nonaktif"}</span>
              </div>
              <span>${escapeHtml(member.childEmail)}</span>
              ${member.phone ? `<span>${escapeHtml(member.phone)}</span>` : ""}
            </div>
            <div class="row-actions">
              <button class="button" type="button" data-toggle-family-member="${member.id}">${member.status === "active" ? "Nonaktifkan" : "Aktifkan"}</button>
              <button class="button danger" type="button" data-delete-family-member="${member.id}">Hapus Akses</button>
            </div>
          </article>
        `).join("")
        : `<div class="empty"><p>Belum ada anggota keluarga.</p><button class="button primary" type="button" data-open-form="familyMember">Tambah Anggota</button></div>`;
    }

    function renderAccount() {
      const state = getState();
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      document.querySelector("#profilePhoto").textContent = currentUser.name.slice(0, 1).toUpperCase();
      document.querySelector("#profileName").textContent = currentUser.name;
      document.querySelector("#profileEmail").textContent = currentUser.email;
      document.querySelector("#profileRole").textContent = isGuest() ? "Tamu" : isChildUser() ? "Anggota Keluarga" : currentUser.role === "admin" ? "Admin" : "User";
      document.querySelector("#profilePinStatus").textContent = state.settings.pin ? "PIN aktif" : "PIN belum aktif";
      document.querySelector("#profileSyncStatus").textContent = isGuest() ? "Demo" : cloudSync.enabled ? "Cloud" : "Lokal";
      const topSyncBadge = document.querySelector("#topSyncBadge");
      if (topSyncBadge) {
        topSyncBadge.textContent = isGuest() ? "Demo" : syncStatusText();
        topSyncBadge.className = `sync-badge ${state.syncStatus === "failed" || cloudSync.lastError ? "error" : state.syncStatus === "pending" ? "pending" : ""}`;
      }
      document.querySelector("#appVersionLabel").textContent = `v${appVersion}`;
      document.querySelector("#darkModeToggle").checked = Boolean(state.settings.darkMode);
      document.querySelector("#cloudSyncToggle").checked = state.settings.cloudSyncEnabled !== false;
      document.querySelector("#languageSelect").value = currentLanguage();
      document.querySelector("#syncStatus").textContent = isGuest() ? "Mode tamu aktif. Login atau registrasi untuk menyimpan data." : syncStatusText();
      document.querySelector("#syncNowButton").disabled = isGuest() || !isCloudSyncAllowed() || cloudSync.isSaving;
      document.querySelector("#reminderStatus").textContent = state.settings.reminderEnabled ? `Aktif pukul ${state.settings.reminderTime}` : "Belum aktif";
      const walletSummary = document.querySelector("#walletSummary");
      if (walletSummary) {
        walletSummary.textContent = state.wallets.length
          ? `${state.wallets.length} dompet, total ${money(state.wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance || 0), 0))}`
          : "Belum ada dompet";
      }
      document.querySelector("#categorySummary").textContent = `${getCategories().length} kategori aktif`;
      document.querySelector("#dashboardMenuSummary").textContent = state.settings.homeSectionOrder.map(dashboardSectionLabel).join(", ");
      document.querySelector("#pinSummary").textContent = state.settings.pin ? "PIN sudah disimpan di perangkat ini." : "PIN belum aktif.";
      document.querySelector("#familySummary").textContent = isChildUser()
        ? "Akun child hanya bisa melihat data keluarga."
        : `${state.familyMembers.filter((member) => member.status === "active").length} anggota aktif`;
      renderFamilyMembers();
      document.querySelectorAll("[data-admin-only]").forEach((element) => {
        element.disabled = !isAdmin();
        element.title = isAdmin() ? "" : "Hanya admin";
      });
      document.querySelector("#loadDemoButton").classList.toggle("hidden", !isGuest());
      document.querySelector("#deleteAccountButton").disabled = isGuest() || isChildUser();
      document.querySelectorAll('[data-open-form="familyMember"]').forEach((button) => {
        button.disabled = isChildUser();
        button.title = isChildUser() ? "Hanya akun utama yang bisa mengelola anggota keluarga." : "";
      });
    }

    return {
      renderAccount,
      renderFamilyMembers,
    };
  },
};
