import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Trash2,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Save,
  FileCheck,
  Star,
  Edit2,
} from "lucide-react";
import { RiListCheck3 } from "react-icons/ri";
import {
  getGlobalTerms,
  saveGlobalTerms,
  getTermsCategories,
  addTermsCategory,
  deleteTermsCategory,
  renameTermsCategory,
} from "../../../data/termsStorage";

const ListEditor = ({
  title,
  icon,
  initialItems,
  onSave,
  placeholder,
  accent,
  readOnly = false,
}) => {
  // items: Array<{ text: string, isDefault: boolean }>
  const [items, setItems] = useState(initialItems || []);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setItems(initialItems || []);
    setIsDirty(false);
  }, [initialItems]);

  const bullet =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-600";
  const headerTint =
    accent === "emerald"
      ? "from-emerald-50/60 to-white"
      : "from-red-50/60 to-white";

  const validItems = items.filter((i) => i.text.trim() !== "");
  const initialValidItems = (initialItems || []).filter(
    (i) => i.text.trim() !== "",
  );
  const showSave =
    !readOnly &&
    isDirty &&
    JSON.stringify(validItems) !== JSON.stringify(initialValidItems);

  const handleUpdate = (idx, value) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], text: value };
    setItems(newItems);
    setIsDirty(true);
  };

  const handleToggleDefault = (idx) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], isDefault: !newItems[idx].isDefault };
    setItems(newItems);
    setIsDirty(true);
  };

  const handleAdd = () => {
    if (items.some((item) => item.text.trim() === "")) return;
    setItems([{ text: "", isDefault: false }, ...items]);
  };

  const handleRemove = (idx) => {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
    setIsDirty(true);
  };

  const handleToggleAllDefault = () => {
    const valid = items.filter((i) => i.text.trim() !== "");
    const allDefault = valid.length > 0 && valid.every((i) => i.isDefault);
    setItems(items.map((i) => ({ ...i, isDefault: !allDefault })));
    setIsDirty(true);
  };

  const handleSaveClick = () => {
    setItems(validItems);
    onSave(validItems);
    setIsDirty(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
      <div
        className={`px-4 py-3 border-b border-bordergray bg-linear-to-r ${headerTint} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[12px] font-bold text-textcolor">{title}</h3>
          <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
            {validItems.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {showSave && (
            <button
              type="button"
              onClick={handleSaveClick}
              className="flex items-center gap-1 text-[11px] font-semibold bg-linear-to-br from-select-blue to-primary text-white bg-emerald-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
            >
              <Save size={12} /> Save
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary cursor-pointer"
            >
              <Plus size={12} /> Add
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto overscroll-contain scroll-smooth scroll-hidden-bar">
        {/* Select All + Add to Default row */}
        {items.length > 0 && !readOnly && (
          <div className="sticky -top-3 bg-white z-10 flex items-center justify-end pb-2 mb-1 border-b border-bordergray/50 -mx-3 px-3 -mt-3">
            <button
              type="button"
              onClick={handleToggleAllDefault}
              className={`flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                items.filter((i) => i.text.trim() !== "").length > 0 &&
                items
                  .filter((i) => i.text.trim() !== "")
                  .every((i) => i.isDefault)
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-amber-600 hover:text-amber-700"
              }`}
            >
              <Star
                size={11}
                fill={
                  items.filter((i) => i.text.trim() !== "").length > 0 &&
                  items
                    .filter((i) => i.text.trim() !== "")
                    .every((i) => i.isDefault)
                    ? "currentColor"
                    : "none"
                }
              />{" "}
              Select All as Default
            </button>
          </div>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 group">
            <span
              className={`mt-2 h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${bullet}`}
            >
              {accent === "emerald" ? (
                <Check size={9} strokeWidth={3} />
              ) : (
                <X size={9} strokeWidth={3} />
              )}
            </span>
            <input
              type="text"
              value={item.text}
              onChange={(e) => handleUpdate(idx, e.target.value)}
              placeholder={placeholder}
              disabled={readOnly}
              className={`bg-bg-soft border border-transparent text-[11.5px] text-textcolor rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:bg-white focus:border-select-blue/40 placeholder:text-text-subtle ${
                readOnly ? "cursor-not-allowed opacity-80" : ""
              }`}
            />
            {/* Default toggle */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleToggleDefault(idx)}
                className={`h-7 w-7 flex items-center justify-center rounded-md shrink-0 transition-colors cursor-pointer ${
                  item.isDefault
                    ? "text-amber-500 bg-amber-50"
                    : "text-text-subtle hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                }`}
                title={
                  item.isDefault ? "Remove from default" : "Set as default"
                }
              >
                <Star
                  size={12}
                  fill={item.isDefault ? "currentColor" : "none"}
                />
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Remove item"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 &&
          (readOnly ? (
            <div className="w-full text-center py-4 text-[11px] text-text-subtle italic border border-dashed border-bordergray rounded-lg">
              No entries configured
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="w-full text-[11px] text-text-subtle border border-dashed border-bordergray rounded-lg py-3 hover:border-select-blue hover:text-select-blue transition-colors cursor-pointer"
            >
              + Add your first entry
            </button>
          ))}
      </div>
    </div>
  );
};

const TermsAndConditions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subFromUrl = searchParams.get("sub");

  const [categories, setCategories] = useState(() => getTermsCategories());
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const cats = getTermsCategories();
    if (subFromUrl && cats.some((c) => c.id === subFromUrl)) {
      return subFromUrl;
    }
    return cats.length > 0 ? cats[0].id : "STATUATORY";
  });

  const [localData, setLocalData] = useState({
    inclusions: [],
    exclusions: [],
  });

  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: "create", // "create" or "rename"
    catId: "",
    inputValue: "",
    descValue: "",
    error: "",
  });

  const [deleteConfirmState, setDeleteConfirmState] = useState({
    isOpen: false,
    catId: "",
    catLabel: "",
  });

  useEffect(() => {
    if (subFromUrl && categories.some((c) => c.id === subFromUrl) && selectedCategory !== subFromUrl) {
      setSelectedCategory(subFromUrl);
    }
  }, [subFromUrl, categories, selectedCategory]);

  useEffect(() => {
    if (selectedCategory) {
      const data = getGlobalTerms(selectedCategory);
      setLocalData(data);
    }
  }, [selectedCategory, categories]);

  const handleListSave = (key, newItems) => {
    const updatedData = { ...localData, [key]: newItems };
    setLocalData(updatedData);
    saveGlobalTerms(selectedCategory, updatedData);
  };

  const getCategoryCount = (catId) => {
    if (catId === selectedCategory) {
      return (localData.inclusions?.length || 0) + (localData.exclusions?.length || 0);
    }
    const data = getGlobalTerms(catId);
    return (data.inclusions?.length || 0) + (data.exclusions?.length || 0);
  };

  const handleOpenCreateModal = () => {
    setModalState({
      isOpen: true,
      mode: "create",
      catId: "",
      inputValue: "",
      descValue: "",
      error: "",
    });
  };

  const handleOpenRenameModal = (id, currentLabel) => {
    const cat = categories.find((c) => c.id === id);
    setModalState({
      isOpen: true,
      mode: "rename",
      catId: id,
      inputValue: currentLabel,
      descValue: cat?.desc || "",
      error: "",
    });
  };

  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    setSearchParams({ tab: "terms", sub: catId });
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    const name = modalState.inputValue.trim();
    const desc = modalState.descValue.trim();
    if (!name) {
      setModalState((prev) => ({ ...prev, error: "Please enter a category name." }));
      return;
    }

    if (modalState.mode === "create") {
      try {
        const newCat = addTermsCategory(name, desc || undefined);
        const updatedCats = getTermsCategories();
        setCategories(updatedCats);
        setSelectedCategory(newCat.id);
        setSearchParams({ tab: "terms", sub: newCat.id });
        setModalState({ isOpen: false, mode: "create", catId: "", inputValue: "", descValue: "", error: "" });
      } catch (err) {
        setModalState((prev) => ({ ...prev, error: err.message || "Failed to create category." }));
      }
    } else {
      // rename mode
      renameTermsCategory(modalState.catId, name, desc);
      const updatedCats = getTermsCategories();
      setCategories(updatedCats);
      setModalState({ isOpen: false, mode: "create", catId: "", inputValue: "", descValue: "", error: "" });
    }
  };

  const handleOpenDeleteConfirm = (id, label) => {
    setDeleteConfirmState({
      isOpen: true,
      catId: id,
      catLabel: label,
    });
  };

  const handleConfirmDelete = () => {
    const id = deleteConfirmState.catId;
    if (!id) return;

    deleteTermsCategory(id);
    const updatedCats = getTermsCategories();
    setCategories(updatedCats);

    // Reset selected category if we deleted the current one
    if (selectedCategory === id) {
      const nextCatId = updatedCats.length > 0 ? updatedCats[0].id : "";
      setSelectedCategory(nextCatId);
      if (nextCatId) {
        setSearchParams({ tab: "terms", sub: nextCatId });
      } else {
        setSearchParams({ tab: "terms" });
      }
    }

    setDeleteConfirmState({
      isOpen: false,
      catId: "",
      catLabel: "",
    });
  };

  const activeCategoryMeta = categories.find((c) => c.id === selectedCategory) || categories[0] || {
    id: "",
    label: "Terms & Conditions",
    desc: "",
  };

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto pb-28 scroll-hidden-bar">
      {/* Header Banner */}
      <div className="sticky top-0 z-30 bg-overallbg/80 backdrop-blur-xl border-b border-bordergray/70">
        <div className="px-6 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex gap-3">
            <div className="relative h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <FileCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                  Terms & Conditions Master
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Global Templates
                </span>
              </div>
              <p className="text-[12px] text-text-muted mt-0.5">
                Configure global inclusions and exclusions across all terms categories
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-linear-to-br from-select-blue to-primary text-white text-[11.5px] font-bold hover:shadow-md transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Categories Tabs Selector */}
      <div className="px-6 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            const counts = getCategoryCount(cat.id);
            return (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectCategory(cat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectCategory(cat.id);
                  }
                }}
                className={`relative flex flex-col items-start text-left p-3.5 rounded-xl border transition-all duration-200 shadow-xs cursor-pointer group select-none min-h-[115px] ${
                  isActive
                    ? "bg-linear-to-br from-select-blue to-primary text-white border-transparent shadow-md shadow-select-blue/10 scale-[1.01]"
                    : "bg-white border-bordergray hover:border-select-blue/30 hover:bg-bg-soft/50 text-textcolor"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-select-blue/5 text-select-blue group-hover:bg-select-blue/10"
                    }`}
                  >
                    <RiListCheck3 size={15} />
                  </div>
                  <span
                    className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-bg-soft text-text-muted border border-bordergray"
                    }`}
                  >
                    {counts} {counts === 1 ? "item" : "items"}
                  </span>
                </div>
                <h3 className={`text-[12.5px] font-bold mt-3 leading-tight transition-colors ${isActive ? "text-white" : "text-textcolor"}`}>
                  {cat.label}
                </h3>
                <p className={`text-[10px] mt-1 transition-colors leading-normal pb-6 pr-8 ${isActive ? "text-white/80" : "text-text-muted"}`}>
                  {cat.desc || "Custom Terms & Conditions category"}
                </p>

                {/* Edit and Delete action buttons at bottom-right, hidden by default, visible on hover */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRenameModal(cat.id, cat.label);
                    }}
                    className={`p-1 rounded-md transition-colors ${
                      isActive
                        ? "text-white/80 hover:text-white hover:bg-white/10"
                        : "text-text-subtle hover:text-select-blue hover:bg-select-blue/5"
                    }`}
                    title="Rename category"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDeleteConfirm(cat.id, cat.label);
                    }}
                    className={`p-1 rounded-md transition-colors ${
                      isActive
                        ? "text-white/80 hover:text-white hover:bg-white/10"
                        : "text-text-subtle hover:text-red-500 hover:bg-red-50"
                    }`}
                    title="Delete category"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lists Editor Section */}
      {selectedCategory && (
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <ListEditor
              key={`${selectedCategory}-inclusions`}
              title={`${activeCategoryMeta.label} Inclusions`}
              icon={<CheckCircle2 size={13} className="text-emerald-600" />}
              accent="emerald"
              initialItems={localData.inclusions || []}
              onSave={(newItems) => handleListSave("inclusions", newItems)}
              placeholder={`e.g. ${activeCategoryMeta.label} standard inclusions`}
            />
            <ListEditor
              key={`${selectedCategory}-exclusions`}
              title={`${activeCategoryMeta.label} Exclusions`}
              icon={<XCircle size={13} className="text-red-500" />}
              accent="red"
              initialItems={localData.exclusions || []}
              onSave={(newItems) => handleListSave("exclusions", newItems)}
              placeholder={`e.g. ${activeCategoryMeta.label} standard exclusions`}
            />
          </div>
        </div>
      )}

      {/* Category Modal (Create / Rename) */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-bordergray shadow-2xl p-6 mx-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-bold text-textcolor">
                {modalState.mode === "create" ? "Add New Category" : "Rename Category"}
              </h3>
              <button
                type="button"
                onClick={() => setModalState({ isOpen: false, mode: "create", catId: "", inputValue: "", descValue: "", error: "" })}
                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Installation Support"
                  value={modalState.inputValue}
                  onChange={(e) => setModalState((prev) => ({ ...prev, inputValue: e.target.value, error: "" }))}
                  className="bg-bg-soft border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:bg-white focus:border-select-blue"
                  autoFocus
                />
                {modalState.error && (
                  <p className="text-red-500 text-[10.5px] font-medium mt-1">
                    {modalState.error}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">
                  Description / Sub Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Installation assistance and guidelines"
                  value={modalState.descValue}
                  onChange={(e) => setModalState((prev) => ({ ...prev, descValue: e.target.value }))}
                  className="bg-bg-soft border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:bg-white focus:border-select-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalState({ isOpen: false, mode: "create", catId: "", inputValue: "", descValue: "", error: "" })}
                  className="px-4 py-2 rounded-lg border border-bordergray text-[11.5px] font-bold text-text-muted hover:bg-bg-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11.5px] font-bold hover:shadow-md"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl border border-bordergray shadow-2xl p-6 mx-4 text-center relative"
          >
            <button
              type="button"
              onClick={() => setDeleteConfirmState({ isOpen: false, catId: "", catLabel: "" })}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close dialog"
            >
              <X size={16} />
            </button>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-50 text-red-600 mb-4">
              <Trash2 size={20} />
            </div>
            
            <h3 className="text-[14px] font-bold text-textcolor mb-2">
              Delete Category
            </h3>
            
            <p className="text-[11.5px] text-text-muted leading-relaxed mb-6">
              Are you sure you want to delete the category <span className="font-bold text-textcolor">"{deleteConfirmState.catLabel}"</span>? 
              This action cannot be undone and will remove it permanently.
            </p>
            
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmState({ isOpen: false, catId: "", catLabel: "" })}
                className="px-4 py-2 rounded-lg border border-bordergray text-[11.5px] font-bold text-text-muted hover:bg-bg-soft cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11.5px] font-bold hover:shadow-md cursor-pointer transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TermsAndConditions;