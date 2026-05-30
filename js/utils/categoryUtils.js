window.AppCategoryUtils = {
  normalizeCategoryName(category) {
    if (typeof category === "string") return category.trim();
    return String(category?.name || category?.label || category?.category || "").trim();
  },

  normalizeCategoryItem(category, index = 0) {
    const name = window.AppCategoryUtils.normalizeCategoryName(category);
    if (!name) return null;
    if (typeof category === "string") {
      return {
        id: `category-${index}-${name}`,
        name,
        value: name,
        parentId: null,
      };
    }
    return {
      id: category.id || `category-${index}-${name}`,
      name,
      value: category.value || category.category || name,
      parentId: category.parentId || null,
    };
  },

  buildCategoryTree({ categories = [], budgets = [] } = {}) {
    const activeBudgets = Array.isArray(budgets) ? budgets.filter((budget) => budget?.isActive !== false) : [];
    const byId = new Map(activeBudgets.map((budget) => [budget.id, budget]));
    const childrenByParent = new Map();
    activeBudgets.forEach((budget) => {
      const parentId = budget.parentId || "";
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(budget);
    });

    const usedCategoryKeys = new Set();
    const rootNodes = [];

    function categoryKeys(item) {
      return [item?.name, item?.value]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
    }

    function reserveCategoryKeys(item) {
      categoryKeys(item).forEach((key) => usedCategoryKeys.add(key));
    }

    function nodeFromBudget(budget, depth = 0) {
      const name = window.AppCategoryUtils.normalizeCategoryName(budget);
      const childBudgets = [...(childrenByParent.get(budget.id) || [])].sort((a, b) => window.AppCategoryUtils.normalizeCategoryName(a).localeCompare(window.AppCategoryUtils.normalizeCategoryName(b), "id"));
      const node = {
        id: budget.id,
        name,
        value: budget.category || name,
        parentId: budget.parentId || null,
        budgetId: budget.id,
        depth,
        source: "budget",
        children: childBudgets.map((child) => nodeFromBudget(child, depth + 1)),
      };
      reserveCategoryKeys(node);
      return node;
    }

    [...(childrenByParent.get("") || [])]
      .sort((a, b) => window.AppCategoryUtils.normalizeCategoryName(a).localeCompare(window.AppCategoryUtils.normalizeCategoryName(b), "id"))
      .forEach((budget) => {
        const name = window.AppCategoryUtils.normalizeCategoryName(budget);
        if (!name) return;
        rootNodes.push(nodeFromBudget(budget));
      });

    activeBudgets
      .filter((budget) => budget.parentId && !byId.has(budget.parentId))
      .sort((a, b) => window.AppCategoryUtils.normalizeCategoryName(a).localeCompare(window.AppCategoryUtils.normalizeCategoryName(b), "id"))
      .forEach((budget) => {
        const name = window.AppCategoryUtils.normalizeCategoryName(budget);
        if (!name || usedCategoryKeys.has(name.toLowerCase())) return;
        rootNodes.push(nodeFromBudget({ ...budget, parentId: null }));
      });

    const normalizedCategories = categories
      .map(window.AppCategoryUtils.normalizeCategoryItem)
      .filter(Boolean)
      .filter((category) => !categoryKeys(category).some((key) => usedCategoryKeys.has(key)));
    const categoryById = new Map(normalizedCategories.map((category) => [category.id, category]));
    const categoryChildren = new Map();
    normalizedCategories.forEach((category) => {
      const parentId = category.parentId && categoryById.has(category.parentId) ? category.parentId : "";
      if (!categoryChildren.has(parentId)) categoryChildren.set(parentId, []);
      categoryChildren.get(parentId).push(category);
    });

    function nodeFromCategory(category, depth = 0) {
      const node = {
        ...category,
        budgetId: "",
        depth,
        source: "category",
        children: (categoryChildren.get(category.id) || []).map((child) => nodeFromCategory(child, depth + 1)),
      };
      reserveCategoryKeys(node);
      return node;
    }

    (categoryChildren.get("") || []).forEach((category) => {
      if (categoryKeys(category).some((key) => usedCategoryKeys.has(key))) return;
      rootNodes.push(nodeFromCategory(category));
    });

    return rootNodes;
  },

  flattenCategoryTreeForSelect(tree = []) {
    const rows = [];
    function visit(node, depth = 0) {
      rows.push({ ...node, depth });
      (node.children || []).forEach((child) => visit(child, depth + 1));
    }
    tree.forEach((node) => visit(node));
    return rows;
  },
};
