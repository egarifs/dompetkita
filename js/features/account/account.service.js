window.AppAccountService = {
  createService(deps) {
    const {
      dataOwnerId,
      familyMember,
      getCurrentUser,
      id,
      isGuest,
      setupCloudClient,
    } = deps;

    function familyMemberRecord({ childName, childEmail, phone = "", childUserId = "", status = "active" }) {
      return familyMember(id(), dataOwnerId(), childEmail.trim().toLowerCase(), childName.trim(), phone.trim(), status, { childUserId });
    }

    function familyMemberCloudPayload(member) {
      return {
        parent_user_id: dataOwnerId(),
        child_user_id: member.childUserId || null,
        child_email: member.childEmail.trim().toLowerCase(),
        child_name: member.childName.trim(),
        phone: member.phone || "",
        role: "child",
        status: member.status === "inactive" ? "inactive" : "active",
      };
    }

    async function upsertFamilyMemberAccess(member) {
      const client = setupCloudClient();
      if (!client || isGuest()) return { ok: true };
      if (!dataOwnerId()) return { ok: false, message: "Akun utama belum terhubung ke Supabase." };
      const { error } = await client
        .from("family_members")
        .upsert(familyMemberCloudPayload(member), { onConflict: "parent_user_id,child_email" });
      return error ? { ok: false, message: error.message || "Akses anggota keluarga belum tersimpan ke Supabase." } : { ok: true };
    }

    async function deleteFamilyMemberAccess(member) {
      const client = setupCloudClient();
      if (!client || isGuest()) return { ok: true };
      const { error } = await client
        .from("family_members")
        .delete()
        .eq("parent_user_id", dataOwnerId())
        .eq("child_email", member.childEmail.trim().toLowerCase());
      return error ? { ok: false, message: error.message || "Akses anggota keluarga belum terhapus dari Supabase." } : { ok: true };
    }

    async function deleteCurrentAccountPermanently() {
      const currentUser = getCurrentUser();
      if (!currentUser) return { ok: false, message: "Sesi akun tidak ditemukan." };
      if (!currentUser.cloudId) return { ok: true, mode: "local" };
      const client = setupCloudClient();
      if (!client) return { ok: false, message: "Koneksi cloud belum aktif. Akun belum dihapus." };
      const { error } = await client.rpc("delete_current_user");
      if (error) {
        return {
          ok: false,
          message: `${error.message || "Akun cloud belum berhasil dihapus."}\n\nJalankan ulang supabase-schema.sql agar RPC delete_current_user tersedia.`,
        };
      }
      return { ok: true, mode: "cloud" };
    }

    return {
      deleteCurrentAccountPermanently,
      deleteFamilyMemberAccess,
      familyMemberCloudPayload,
      familyMemberRecord,
      upsertFamilyMemberAccess,
    };
  },
};
