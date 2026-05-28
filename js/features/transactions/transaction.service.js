window.AppTransactionService = {
  createService(deps) {
    const {
      id,
      normalizeTransaction,
      tx,
    } = deps;

    function record(type, date, category, description, amount, meta = {}) {
      return tx(id(), type, date, category, description, amount, meta);
    }

    function updateRecord(target, values) {
      const normalized = normalizeTransaction({
        ...target,
        ...values,
        id: target.id,
        createdAt: target.createdAt,
        updatedAt: new Date().toISOString(),
      });
      Object.assign(target, normalized);
    }

    return {
      record,
      updateRecord,
    };
  },
};
