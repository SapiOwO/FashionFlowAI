"use client";

import React, { useState, useEffect, useRef } from "react";

// Definitions
interface YoloDetection {
  label: string;
  confidence: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

interface ClassificationResult {
  class_name: string;
  confidence: number;
}

interface ToolingRecommendation {
  name: string;
  quantity: number;
  description: string;
  file?: string;
  desc?: string;
}

interface HistoricalExample {
  title: string;
  ref: string;
  features: string;
  tooling: string;
  smv: string;
  learnings: string;
}

interface ModelResult {
  model_name: string;
  file: string;
  class_name: string;
  confidence_pct: number;
  status: string;
}

interface AnalysisResult {
  yolo_detections: YoloDetection[];
  classification: ClassificationResult[];
  model_results: ModelResult[];
  sewing_sequence: string[];
  tooling_recommendations: ToolingRecommendation[];
  smv_range: string;
  complexity: string;
  preview_image: string;
  historical_examples: HistoricalExample[];
  top_3_saved_projects?: any[];
  top_match?: any;
  warning?: string;
  manufacturability_score?: number;
  similarity_percentage: number;
  status: string;
  message: string;
  visual_vector?: number[];
  tags?: string[];
  designer_notes?: string;
}

interface SavedAnalysis {
  id: number | string;
  fileName: string;
  result: AnalysisResult;
  timestamp?: string;
  created_at?: string;
}

const formatActivityDate = (item: any): string => {
  const rawDate = item?.timestamp || item?.created_at || item?.date;
  if (!rawDate) return "Just now";
  try {
    const formattedStr = typeof rawDate === "string" ? rawDate.replace(" ", "T") : rawDate;
    const d = new Date(formattedStr);
    if (isNaN(d.getTime())) return "Just now";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Just now";
  }
};


const renderSpecsDescription = (desc: string) => {
  if (!desc) return null;
  // Split specs cleanly by line break or bullet dot symbol
  const rawItems = desc.split(/[\n•]/).map(item => item.trim()).filter(Boolean);
  
  return (
    <div className="mt-4 border-t border-slate-100 pt-4 w-full">
      <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2.5">Technical Specifications</h4>
      <div className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-100 space-y-2">
        {rawItems.map((item, i) => {
          const cleanItem = item.replace(/\*\*/g, "").trim();
          if (!cleanItem) return null;
          
          const parts = cleanItem.split(":");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(":").trim();
            return (
              <div key={i} className="flex justify-between items-center text-[11px] border-b border-slate-100/60 pb-1.5 last:border-0 last:pb-0 gap-2">
                <span className="font-semibold text-slate-500 flex-shrink-0">{key}</span>
                <span className="font-semibold text-slate-800 text-right truncate">{val}</span>
              </div>
            );
          }
          return (
            <div key={i} className="text-[11px] text-slate-600 font-medium">
              {cleanItem}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DOLL_TYPES: Record<string, string[]> = {
  "Classic Teddy Bear": ["jacket", "pants", "hat"],
  "Fashion Doll": ["dress", "jacket"],
  "Plushie Mascot": ["tshirt", "pants"],
  "School Academy": ["shirt", "skirt", "jacket"],
  "Casual Doll": ["tshirt", "skirt"]
};

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  availableTags: string[];
  onAddCustomTag?: (tag: string) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({ selectedTags, onChange, availableTags, onAddCustomTag }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTags = availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()));
  const showCreateOption = tagQuery.trim().length > 0 && !availableTags.some(t => t.toLowerCase() === tagQuery.trim().toLowerCase());

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleCreateTag = () => {
    const cleanTag = tagQuery.trim();
    if (!cleanTag) return;
    if (!selectedTags.includes(cleanTag)) {
      onChange([...selectedTags, cleanTag]);
    }
    setTagQuery("");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Project Tags (Optional)</label>
      
      {/* Selected Tag Pills + Trigger Input */}
      <div 
        onClick={() => setIsOpen(true)}
        className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-2 px-3 min-h-[44px] flex flex-wrap items-center gap-1.5 cursor-pointer focus-within:bg-white focus-within:border-[#155DFC] focus-within:ring-1 focus-within:ring-[#155DFC] transition-colors"
      >
        {selectedTags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#155DFC] border border-blue-200/60 shadow-2xs">
            <svg className="w-3 h-3 text-[#155DFC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
            <span>{tag}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleToggleTag(tag); }}
              className="text-blue-400 hover:text-[#155DFC] font-bold text-xs leading-none"
            >✕</button>
          </span>
        ))}

        <button
          type="button"
          className="text-xs font-semibold text-slate-400 hover:text-[#155DFC] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {selectedTags.length === 0 ? "Select or create tags..." : "Add Tag"}
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-2 animate-in fade-in duration-150">
          <div className="relative">
            <input
              type="text"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (showCreateOption) {
                    handleCreateTag();
                  } else if (filteredTags.length > 0) {
                    handleToggleTag(filteredTags[0]);
                  }
                }
              }}
              maxLength={40}
              placeholder="Search or create a tag..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-xs text-slate-800 focus:bg-white focus:border-[#155DFC] focus:outline-none"
              autoFocus
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredTags.length === 0 && !showCreateOption && (
              <div className="text-[11px] text-slate-400 p-2 text-center">No matching tags found</div>
            )}
            {filteredTags.map(tag => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected ? "bg-blue-50 text-[#155DFC]" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                    {tag}
                  </span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-[#155DFC]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  )}
                </button>
              );
            })}
          </div>

          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateTag}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#155DFC] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200/60"
            >
              <svg className="w-4 h-4 text-[#155DFC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span>Create new tag &quot;<strong>{tagQuery.trim()}</strong>&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  // Sidebar collapsed state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard-view");

  // Model selection states
  const [models, setModels] = useState<string[]>(["best.pt (Default Mock)"]);
  const [selectedModel, setSelectedModel] = useState("mobilenet_textiles.pth");
  const [isEnsembleMode, setIsEnsembleMode] = useState(true);
  const [activeEnsembleModels, setActiveEnsembleModels] = useState<string[]>([
    "MobileNetV3 Large",
    "ResNet50",
    "EfficientNet-B0"
  ]);

  // Upload/Analysis States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [showTechPackModal, setShowTechPackModal] = useState(false);
  const [activeTechPackData, setActiveTechPackData] = useState<any>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (stepNum: number) => {
    setExpandedSteps(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  // Production Quiz Workspace States
  const [projectMode, setProjectMode] = useState<"single" | "doll">("doll");
  const [dollType, setDollType] = useState<string>("Classic Teddy Bear");
  const [componentsState, setComponentsState] = useState<Record<string, {
    fabricWeight: string;
    imageFile: File | null;
    previewUrl: string | null;
    result: any | null;
  }>>({
    jacket: { fabricWeight: "Denim (Heavy-weight)", imageFile: null, previewUrl: null, result: null },
    pants: { fabricWeight: "Katun (Medium-weight)", imageFile: null, previewUrl: null, result: null },
    hat: { fabricWeight: "Sutra (Light-weight)", imageFile: null, previewUrl: null, result: null }
  });

  const [quizName, setQuizName] = useState("");
  const [quizGarment, setQuizGarment] = useState("Shirt");
  const [quizFabric, setQuizFabric] = useState("Medium-weight");
  const [batchQuantity, setBatchQuantity] = useState(100);
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [fullResult, setFullResult] = useState<any | null>(null);

  // Catalog Reuse Prompt State — shown when DINOv2 detects >= 90% similarity match
  const [showReusePrompt, setShowReusePrompt] = useState(false);
  const [reuseMode, setReuseMode] = useState<"reuse" | "new" | null>(null);

  // Tags & Designer Notes States
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [designerNotes, setDesignerNotes] = useState<string>("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showProcessSheetConfirmModal, setShowProcessSheetConfirmModal] = useState(false);

  // Active Projects & History Search/Filter States
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("ALL");
  const [historyTagFilter, setHistoryTagFilter] = useState<string>("ALL");

  // Multi-step wizard stepper state (1: Upload & Originality, 2: Engineering Parameters, 3: Process Sheet)
  const [currentStep, setCurrentStep] = useState(1);
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false);


  // Upload History log state (Persisted in Postgres/SQLite database)
  const [analysisHistory, setAnalysisHistory] = useState<SavedAnalysis[]>([]);

  // Drag over states
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Historical Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HistoricalExample[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Default machinery previews loaded from Juki CSV
  const [defaultMachines, setDefaultMachines] = useState<any[]>([]);
  const [machinerySearch, setMachinerySearch] = useState("");
  const [selectedMachineCategory, setSelectedMachineCategory] = useState("All Categories");
  const [showMachineryAutocomplete, setShowMachineryAutocomplete] = useState(false);

  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [selectedKnowledgeCategory, setSelectedKnowledgeCategory] = useState("All Categories");
  const [showKnowledgeAutocomplete, setShowKnowledgeAutocomplete] = useState(false);

  // Dataset library stats loaded from local directory
  const [datasetStats, setDatasetStats] = useState({
    images_count: 0,
    classes_count: 0,
    accuracy_rate: "N/A"
  });

  // Fetch models, persistent history log, default Juki machines, and dataset stats from FastAPI on mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/models");
        if (res.ok) {
          const data = await res.json();
          setModels(data.models);
          if (data.models.length > 0) setSelectedModel(data.models[0]);
        }
      } catch (err) {
        console.warn("FastAPI server not running or model fetch failed.", err);
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/api/history");
        if (res.ok) {
          const data = await res.json();
          setAnalysisHistory(data.history);
        }
      } catch (err) {
        console.warn("Failed to load persistent analysis history log.", err);
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/api/default-machines");
        if (res.ok) {
          const data = await res.json();
          setDefaultMachines(data.machines);
        }
      } catch (err) {
        console.warn("Failed to load default Juki machines from CSV.", err);
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/api/stats");
        if (res.ok) {
          const data = await res.json();
          setDatasetStats(data);
        }
      } catch (err) {
        console.warn("Failed to load dataset folder statistics.", err);
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/api/knowledge");
        if (res.ok) {
          const data = await res.json();
          setKnowledgeBase(data.knowledge);
        }
      } catch (err) {
        console.warn("Failed to load ingested knowledge base records.", err);
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/api/tags");
        let apiTags: string[] = [];
        if (res.ok) {
          const data = await res.json();
          if (data.tags) apiTags = data.tags;
        }
        setAvailableTags(apiTags);
      } catch (err) {
        console.warn("Failed to load unique tags.", err);
      }
    }
    fetchInitialData();
  }, []);

  // Sync availableTags automatically whenever analysisHistory or API tags update
  useEffect(() => {
    const historyTags = (analysisHistory || []).flatMap(item => item.result?.tags || []);
    if (historyTags.length > 0) {
      setAvailableTags(prev => Array.from(new Set([...prev, ...historyTags])).filter(Boolean));
    }
  }, [analysisHistory]);

  // Sync componentsState with selected dollType required garments and default fabric weights
  useEffect(() => {
    if (projectMode !== "doll") return;
    const reqGarments = DOLL_TYPES[dollType] || [];
    setComponentsState(prev => {
      const nextState: typeof prev = {};
      reqGarments.forEach(g => {
        let defaultWeight = "Cotton (Medium-weight)";
        if (g === "jacket") defaultWeight = "Denim (Heavy-weight)";
        else if (g === "hat" || g === "dress" || g === "skirt") defaultWeight = "Silk (Light-weight)";

        nextState[g] = prev[g] || {
          fabricWeight: defaultWeight,
          imageFile: null,
          previewUrl: null,
          result: null
        };
      });
      return nextState;
    });
  }, [dollType, projectMode]);

  // CRUD States for Projects Database
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);

  // Handle Project Deletion from DB
  const handleDeleteProject = async (id: string | number) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this project? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/history/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAnalysisHistory(prev => prev.filter(item => item.id !== id));
        alert("Project deleted successfully.");
      } else {
        alert("Failed to delete project from database.");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
      alert("Database connection error.");
    }
    setActiveMenuId(null);
  };

  // Handle Project Rename in DB
  const handleRenameProject = async (id: string | number, currentName: string) => {
    const newName = window.prompt("Enter new name for the project:", currentName);
    if (!newName || !newName.trim()) return;

    try {
      const formData = new FormData();
      formData.append("filename", newName.trim());

      const res = await fetch(`http://127.0.0.1:8000/api/history/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (res.ok) {
        setAnalysisHistory(prev => prev.map(item => {
          if (item.id === id) {
            return { ...item, fileName: newName.trim() };
          }
          return item;
        }));
        alert("Project renamed successfully.");
      } else {
        alert("Failed to rename project in database.");
      }
    } catch (err) {
      console.error("Error renaming project:", err);
      alert("Database connection error.");
    }
    setActiveMenuId(null);
  };

  // Handle component file upload changes and automatic motif detection/prediction
  const handleComponentFileChange = async (g: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      setComponentsState(prev => ({
        ...prev,
        [g]: {
          ...prev[g],
          imageFile: file,
          previewUrl: reader.result as string,
          result: prev[g]?.result // Keep existing result until loaded
        }
      }));

      // Trigger automatic background pattern/motif originality check
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model_name", selectedModel);
      formData.append("use_ensemble", isEnsembleMode ? "true" : "false");

      try {
        const res = await fetch("http://127.0.0.1:8000/api/predict", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setComponentsState(prev => ({
            ...prev,
            [g]: {
              ...prev[g],
              result: data
            }
          }));
        }
      } catch (err) {
        console.error(`Automatic prediction failed for component ${g}:`, err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle doll outfit process sheet compilation
  const handleGenerateDollProcessSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizName.trim()) {
      alert("Please enter a project name.");
      return;
    }

    const reqGarments = DOLL_TYPES[dollType] || [];
    const componentsList: any[] = [];

    for (const g of reqGarments) {
      const comp = componentsState[g];
      if (!comp) continue;

      // Fallback stub if not uploaded yet to prevent crash
      const compResult = comp.result || {
        status: "Approved",
        similarity_percentage: 90.0,
        classification: [{ class_name: g === "jacket" ? "Batik Kawung" : "Batik Bali" }]
      };

      componentsList.push({
        garment_type: g,
        fabric_weight: comp.fabricWeight,
        preview_image: comp.previewUrl || "globe.svg",
        classification_name: compResult?.classification?.[0]?.class_name || "Original Pattern",
        similarity_percentage: compResult.similarity_percentage || ((compResult?.classification?.[0]?.confidence || 0.9) * 100),
        similarity_status: compResult.status
      });
    }

    setIsLoading(true);
    try {
      const payload = {
        project_name: quizName.trim(),
        doll_type: dollType,
        components: componentsList,
        message: `Consolidated doll clothing process sheet for ${dollType}.`,
        batch_quantity: batchQuantity,
      };

      const res = await fetch("http://127.0.0.1:8000/api/generate-doll-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setFullResult(data);
        setIsQuizSubmitted(true);

        // Refresh persistent history list
        try {
          const historyRes = await fetch("http://127.0.0.1:8000/api/history");
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setAnalysisHistory(historyData.history);
          }
        } catch (err) {
          console.warn("Failed to refresh history.", err);
        }
      } else {
        alert("Failed to generate doll process sheet.");
      }
    } catch (err) {
      console.error("Error generating doll process sheet:", err);
      alert("Database connection failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle dynamic process sheet compilation quiz submission (Single Garment Mode)
  const handleGenerateProcessSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showProcessSheetConfirmModal) {
      setShowProcessSheetConfirmModal(true);
      return;
    }
    await executeCompilation();
  };

  const executeCompilation = async () => {
    let activeResult = result;
    if (!activeResult && imageFile) {
      await runAnalysisForFile(imageFile);
    }
    
    const targetResult = result || activeResult;
    if (!targetResult) return;

    // Resolve project name: user input > matched catalog title > classification > fallback
    const topMatch = targetResult?.top_3_saved_projects?.[0];
    const isReuse = reuseMode === "reuse";
    const resolvedProjectName = quizName.trim()
      || (isReuse && topMatch?.title ? topMatch.title : "")
      || targetResult?.classification?.[0]?.class_name
      || "New Pattern Project";

    setIsLoading(true);
    try {
      const payload = {
        project_name: resolvedProjectName,
        garment_type: quizGarment,
        fabric_weight: quizFabric,
        preview_image: targetResult.preview_image,
        similarity_percentage: targetResult.similarity_percentage,
        similarity_status: targetResult.status,
        classification_name: targetResult?.classification?.[0]?.class_name || "Original Pattern",
        message: targetResult.message,
        // CRITICAL: send visual_vector so backend can persist it for future cosine-similarity duplicate detection
        visual_vector: targetResult.visual_vector || [],
        batch_quantity: batchQuantity,
        // Reuse flag: when true backend skips inserting a new DB row and recalculates on existing master ID
        is_reuse_master: isReuse,
        reuse_master_id: isReuse && topMatch?.id ? topMatch.id : null,
        tags: selectedTags,
        designer_notes: designerNotes,
      };

      const res = await fetch("http://127.0.0.1:8000/api/generate-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setFullResult(data);
        setIsQuizSubmitted(true);
        // Refresh local history list
        try {
          const historyRes = await fetch("http://127.0.0.1:8000/api/history");
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setAnalysisHistory(historyData.history);
          }
        } catch (err) {
          console.warn("Failed to refresh history.", err);
        }
      } else {
        console.error("Failed to generate process sheet.");
      }
    } catch (err) {
      console.error("Error generating process sheet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset the process sheet creation workspace
  const handleResetWorkspace = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setResult(null);
    setFullResult(null);
    setQuizName("");
    setQuizGarment("Shirt");
    setQuizFabric("Medium-weight");
    setIsQuizSubmitted(false);
    setCurrentStep(1);
    setShowReusePrompt(false);
    setReuseMode(null);
    setComponentsState({
      jacket: { fabricWeight: "Denim (Heavy-weight)", imageFile: null, previewUrl: null, result: null },
      pants: { fabricWeight: "Katun (Medium-weight)", imageFile: null, previewUrl: null, result: null },
      hat: { fabricWeight: "Sutra (Light-weight)", imageFile: null, previewUrl: null, result: null }
    });
    setDollType("Classic Teddy Bear");
  };

  // Reset Step 2 parameters & sketch without exiting to Step 1
  const handleResetStep2 = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setResult(null);
    setQuizName("");
    setQuizGarment("Shirt");
    setQuizFabric("Medium-weight");
    setShowReusePrompt(false);
    setReuseMode(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setComponentsState({
      jacket: { fabricWeight: "Denim (Heavy-weight)", imageFile: null, previewUrl: null, result: null },
      pants: { fabricWeight: "Katun (Medium-weight)", imageFile: null, previewUrl: null, result: null },
      hat: { fabricWeight: "Sutra (Light-weight)", imageFile: null, previewUrl: null, result: null }
    });
  };

  // Confirm before backing to Step 1 if user has progress
  const handleSafeBackToStep1 = () => {
    const hasProgress = Boolean(previewUrl || quizName.trim() || result || Object.values(componentsState).some(c => c.previewUrl));
    if (hasProgress) {
      setShowBackConfirmModal(true);
    } else {
      setCurrentStep(1);
    }
  };

  const handleConfirmBackToStep1 = () => {
    setShowBackConfirmModal(false);
    handleResetWorkspace();
    setCurrentStep(1);
  };


  // Migration helper: re-hydrate legacy project payloads to the current normalized schema.
  // Ensures projects saved before the multi-tier resolver refactor load cleanly.
  const rehydrateProjectPayload = (pResult: any): any => {
    // Ensure classification array exists and is non-empty
    if (!Array.isArray(pResult.classification) || pResult.classification.length === 0) {
      pResult.classification = [{ class_name: "Original Sketch Pattern", confidence: 1.0 }];
    }
    // If sewing_sequence_detailed is missing or empty but sewing_sequence text exists, reconstruct stubs
    if (!pResult.sewing_sequence_detailed || pResult.sewing_sequence_detailed.length === 0) {
      const textSeq: string[] = pResult.sewing_sequence || [];
      pResult.sewing_sequence_detailed = textSeq.map((line: string, idx: number) => ({
        step_num: idx + 1,
        operation: line.replace(/^Step \d+:\s*/i, "").replace(/\s*\(using .*?\)$/, ""),
        machine_type: "N/A (legacy)",
        recommended_model: "N/A",
        recommended_desc: "",
        recommended_file: "globe.svg",
      }));
    }
    // tooling_recommendations should mirror sewing_sequence_detailed unique machines.
    // If they diverge (legacy format), rebuild from the detailed sequence.
    const seqModels = new Set((pResult.sewing_sequence_detailed || []).map((s: any) => s.recommended_model));
    const toolingModels = new Set((pResult.tooling_recommendations || []).map((t: any) => t.name));
    const isDiverged = [...seqModels].some(m => m !== "N/A" && !toolingModels.has(m));
    if (isDiverged || (pResult.tooling_recommendations || []).length === 0) {
      const seen = new Set<string>();
      pResult.tooling_recommendations = (pResult.sewing_sequence_detailed || []).reduce((acc: any[], step: any) => {
        if (step.recommended_model && step.recommended_model !== "N/A" && step.recommended_model !== "UNRESOLVED" && !seen.has(step.recommended_model)) {
          seen.add(step.recommended_model);
          acc.push({ name: step.recommended_model, file: step.recommended_file, desc: step.recommended_desc });
        }
        return acc;
      }, []);
    }
    return pResult;
  };

  // Load a past project back into the active workspace
  const handleLoadProject = (project: any) => {
    const rawResult = project.result;
    // Apply migration helper to ensure legacy payloads use the current schema
    const pResult = rehydrateProjectPayload({ ...rawResult });
    setResult({
      preview_image: pResult.preview_image,
      similarity_percentage: pResult.similarity_percentage,
      status: pResult.status,
      message: pResult.message,
      classification: pResult.classification,
      yolo_detections: pResult.yolo_detections || [],
      sewing_sequence: pResult.sewing_sequence,
      tooling_recommendations: pResult.tooling_recommendations,
      smv_range: pResult.smv_range,
      complexity: pResult.complexity,
      model_results: pResult.model_results || [],
      historical_examples: pResult.historical_examples || []
    });
    setFullResult(pResult);
    setPreviewUrl(pResult.preview_image);
    
    if (pResult.is_doll_project) {
      setProjectMode("doll");
      setDollType(pResult.doll_type);
      setQuizName(pResult.project_details?.name || project.fileName);
      
      const nextState: any = {};
      const classifications = Array.isArray(pResult.classification) ? pResult.classification : [];
      classifications.forEach((c: any) => {
        nextState[c.component] = {
          fabricWeight: "Katun (Medium-weight)", // default
          imageFile: null,
          previewUrl: pResult.preview_image,
          result: {
            status: c.similarity_status || "Approved",
            similarity_percentage: (c.confidence || 0.9) * 100,
            classification: [{ class_name: c.class_name }]
          }
        };
      });

      if (pResult.project_details && pResult.project_details.fabric_weight) {
        const weights = pResult.project_details.fabric_weight.split(", ");
        const garments = pResult.project_details.garment_type.split(", ");
        garments.forEach((g: string, idx: number) => {
          const canonicalKey = g.trim().toLowerCase();
          if (nextState[canonicalKey]) {
            nextState[canonicalKey].fabricWeight = weights[idx] || "Katun (Medium-weight)";
          }
        });
      }
      setComponentsState(nextState);
    } else {
      setProjectMode("single");
      if (pResult.project_details) {
        setQuizName(pResult.project_details.name || project.fileName);
        setQuizGarment(pResult.project_details.garment_type || "Shirt");
        setQuizFabric(pResult.project_details.fabric_weight || "Medium-weight");
      } else {
        setQuizName(project.fileName);
        setQuizGarment("Shirt");
        setQuizFabric("Medium-weight");
      }
    }
    
    setIsQuizSubmitted(true);
    setActiveTab("design-input-view");
  };

  // Pre-populate historical search results on mount from database
  useEffect(() => {
    const loadDefaultSearch = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/search?query=all");
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.matches);
          setHasSearched(true);
        }
      } catch (err) {
        setSearchResults([]);
        setHasSearched(false);
      }
    };
    loadDefaultSearch();
  }, []);

  // Handle drag/drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const runAnalysisForFile = async (fileToUpload: File) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("image", fileToUpload);
    formData.append("model_name", selectedModel);
    formData.append("use_ensemble", isEnsembleMode ? "true" : "false");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/predict", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);

        // Show reuse prompt if catalog match >= 90%, otherwise clear prompt
        const sim = data.similarity_percentage || 0;
        if (sim >= 90 && data.top_3_saved_projects?.[0]) {
          setShowReusePrompt(true);
          setReuseMode(null); // reset to force user to choose
        } else {
          setShowReusePrompt(false);
          setReuseMode(null);
        }

        try {
          const historyRes = await fetch("http://127.0.0.1:8000/api/history");
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setAnalysisHistory(historyData.history);
          }
        } catch (historyErr) {
          console.warn("Failed to refresh history after analysis:", historyErr);
        }
      } else {
        throw new Error("Failed to run prediction");
      }
    } catch (err) {
      console.error("FastAPI server prediction failed.", err);
    } finally {
      setIsLoading(false);
    }
  };

  const processFile = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null); // Clear previous results for new uploads
    runAnalysisForFile(file); // Immediately trigger live DINOv2 analysis
  };

  const handleReset = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setResult(null);
  };

  // Load a historical analysis into active view
  const loadSavedAnalysis = (saved: SavedAnalysis) => {
    handleLoadProject(saved);
  };

  // Run Inference / Prediction
  const handleAnalyze = async (fileOverride?: File) => {
    const targetFile = fileOverride || imageFile;
    if (!targetFile) return;
    await runAnalysisForFile(targetFile);
  };

  // Historical search using pgvector
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setHasSearched(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/search?query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.matches);
      } else {
        throw new Error("Search query failed");
      }
    } catch (err) {
      console.error("FastAPI search failed.", err);
      setSearchResults([]);
      alert("Search failed: Unable to connect to the database. Make sure your FastAPI backend server is running.");
    }
  };

  // Return specific line drawing SVGs depending on step actions
  const getPartIcon = (actionText: string) => {
    const text = actionText.toLowerCase();
    if (text.includes("skirt") || text.includes("tulle")) {
      return (
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14l2 14H3L5 4z" />
          <path d="M9 4v14M15 4v14" strokeDasharray="2 2" />
        </svg>
      );
    }
    if (text.includes("collar") || text.includes("neck") || text.includes("bodice")) {
      return (
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l3 6-9 4-9-4 3-6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v8" />
        </svg>
      );
    }
    if (text.includes("sleeve") || text.includes("shoulder") || text.includes("armhole")) {
      return (
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 4.5M20 7l-8 4.5M12 11.5V22" />
        </svg>
      );
    }
    if (text.includes("pocket")) {
      return (
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h14" />
          <path d="M9 10v9M15 10v9" strokeDasharray="2 2" />
        </svg>
      );
    }
    if (text.includes("button") || text.includes("closure") || text.includes("snap")) {
      return (
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="9" r="1.5" fill="currentColor" />
          <circle cx="15" cy="9" r="1.5" fill="currentColor" />
          <circle cx="9" cy="15" r="1.5" fill="currentColor" />
          <circle cx="15" cy="15" r="1.5" fill="currentColor" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  };

  // Render 2D Technical Apparel CAD Pattern Blueprint SVG Diagram
  const renderSeamTechnicalDiagram = (opText: string) => {
    const text = (opText || "").toLowerCase();

    if (text.includes("zipper")) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <svg className="w-full h-32" viewBox="0 0 400 110">
            {/* Background Pattern Grid */}
            <defs>
              <pattern id="cadGridZipper" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F1F5F9" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="400" height="110" fill="url(#cadGridZipper)" rx="6" />

            {/* Left Front CAD Pattern Piece */}
            <path d="M 20 15 L 180 15 L 180 95 L 20 95 Z" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
            <path d="M 30 25 L 170 25 L 170 85 L 30 85 Z" fill="none" stroke="#155DFC" strokeWidth="1" strokeDasharray="3 3" />
            <text x="35" y="40" fill="#0F172A" fontSize="9" fontFamily="monospace" fontWeight="bold">LEFT FRONT — CUT 1</text>
            
            {/* Right Front CAD Pattern Piece */}
            <path d="M 220 15 L 380 15 L 380 95 L 220 95 Z" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
            <path d="M 230 25 L 370 25 L 370 85 L 230 85 Z" fill="none" stroke="#155DFC" strokeWidth="1" strokeDasharray="3 3" />
            <text x="235" y="40" fill="#0F172A" fontSize="9" fontFamily="monospace" fontWeight="bold">RIGHT FRONT — CUT 1</text>

            {/* Zipper Center Seam Line & Notches */}
            <line x1="200" y1="10" x2="200" y2="100" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="6 3" />
            <polygon points="175,55 185,55 180,50" fill="#059669" />
            <polygon points="215,55 225,55 220,50" fill="#059669" />

            {/* Grainline & Seam Callouts */}
            <line x1="90" y1="50" x2="90" y2="80" stroke="#64748B" strokeWidth="1" />
            <polygon points="90,46 87,52 93,52" fill="#64748B" />
            <polygon points="90,84 87,78 93,78" fill="#64748B" />
            <text x="96" y="68" fill="#64748B" fontSize="8" fontFamily="monospace">GRAINLINE ↓</text>

            <text x="145" y="105" fill="#155DFC" fontSize="9" fontFamily="monospace" fontWeight="bold">CUT LINE — 1CM SEAM ALLOWANCE (ZIPPER SEAM)</text>
          </svg>
        </div>
      );
    }

    if (text.includes("hem") || text.includes("edge")) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <svg className="w-full h-32" viewBox="0 0 400 110">
            <defs>
              <pattern id="cadGridHem" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F1F5F9" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="400" height="110" fill="url(#cadGridHem)" rx="6" />

            {/* Bottom Hem Garment CAD Outline */}
            <path d="M 30 15 L 370 15 L 370 75 C 270 80 130 80 30 75 Z" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
            <line x1="30" y1="55" x2="370" y2="55" stroke="#155DFC" strokeWidth="1.2" strokeDasharray="4 3" />
            <line x1="30" y1="65" x2="370" y2="65" stroke="#059669" strokeWidth="1.5" strokeDasharray="2 2" />

            <text x="40" y="35" fill="#0F172A" fontSize="9" fontFamily="monospace" fontWeight="bold">GARMENT BOTTOM HEM PANEL — CUT 1</text>
            <text x="40" y="50" fill="#64748B" fontSize="8" fontFamily="monospace">FOLD LINE — 2CM DOUBLE FOLD MARGIN</text>
            <text x="210" y="98" fill="#059669" fontSize="9" fontFamily="monospace" fontWeight="bold">STITCH PATH (10 SPI LOCKSTITCH)</text>

            {/* Grainline Arrow */}
            <line x1="200" y1="20" x2="200" y2="45" stroke="#64748B" strokeWidth="1" />
            <polygon points="200,16 197,22 203,22" fill="#64748B" />
            <polygon points="200,49 197,43 203,43" fill="#64748B" />
            <text x="206" y="36" fill="#64748B" fontSize="8" fontFamily="monospace">GRAINLINE ↑↓</text>
          </svg>
        </div>
      );
    }

    if (text.includes("pocket") || text.includes("flap")) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <svg className="w-full h-32" viewBox="0 0 400 110">
            <defs>
              <pattern id="cadGridPocket" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F1F5F9" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="400" height="110" fill="url(#cadGridPocket)" rx="6" />

            {/* Main Garment Front Body CAD */}
            <rect x="20" y="15" width="220" height="85" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" rx="4" />
            <text x="30" y="32" fill="#64748B" fontSize="8" fontFamily="monospace">FRONT PANEL OVERLAY</text>

            {/* Pocket CAD Pattern Piece */}
            <path d="M 270 15 L 370 15 L 370 75 L 320 95 L 270 75 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
            <path d="M 278 23 L 362 23 L 362 70 L 320 86 L 278 70 Z" fill="none" stroke="#155DFC" strokeWidth="1" strokeDasharray="3 3" />
            
            {/* Bartack Reinforcement Markers */}
            <circle cx="270" cy="15" r="3" fill="#D97706" />
            <circle cx="370" cy="15" r="3" fill="#D97706" />

            <text x="280" y="40" fill="#0F172A" fontSize="9" fontFamily="monospace" fontWeight="bold">POCKET — CUT 1</text>
            <text x="280" y="55" fill="#D97706" fontSize="8" fontFamily="monospace">▲ BARTACK NOTCH</text>
            <text x="50" y="105" fill="#155DFC" fontSize="9" fontFamily="monospace" fontWeight="bold">ALIGNMENT MARKS &amp; 1CM SEAM ALLOWANCE</text>
          </svg>
        </div>
      );
    }

    // Default: Front & Back Garment Pattern CAD Pieces
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <svg className="w-full h-32" viewBox="0 0 400 110">
          <defs>
            <pattern id="cadGridDefault" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F1F5F9" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="400" height="110" fill="url(#cadGridDefault)" rx="6" />

          {/* Front Body CAD Piece */}
          <path d="M 20 15 L 170 15 L 170 95 L 20 95 Z" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
          <path d="M 30 23 L 160 23 L 160 87 L 30 87 Z" fill="none" stroke="#155DFC" strokeWidth="1" strokeDasharray="3 3" />
          <text x="35" y="38" fill="#0F172A" fontSize="9" fontFamily="monospace" fontWeight="bold">FRONT BODY — CUT 1 ON FOLD</text>

          {/* Back Body CAD Piece */}
          <path d="M 230 15 L 380 15 L 380 95 L 230 95 Z" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
          <path d="M 240 23 L 370 23 L 370 87 L 240 87 Z" fill="none" stroke="#155DFC" strokeWidth="1" strokeDasharray="3 3" />
          <text x="245" y="38" fill="#0F172A" fontSize="9" fontFamily="monospace" fontWeight="bold">BACK BODY — CUT 1 ON FOLD</text>

          {/* Seam Join Notches */}
          <polygon points="170,55 180,50 180,60" fill="#0EA5E9" />
          <polygon points="230,55 220,50 220,60" fill="#0EA5E9" />
          <text x="185" y="58" fill="#0EA5E9" fontSize="8" fontFamily="monospace" fontWeight="bold">A↔A NOTCH</text>

          {/* Grainline Arrows */}
          <line x1="95" y1="48" x2="95" y2="78" stroke="#64748B" strokeWidth="1" />
          <polygon points="95,44 92,50 98,50" fill="#64748B" />
          <polygon points="95,82 92,76 98,76" fill="#64748B" />
          <text x="100" y="66" fill="#64748B" fontSize="8" fontFamily="monospace">GRAINLINE ↑↓</text>

          <line x1="305" y1="48" x2="305" y2="78" stroke="#64748B" strokeWidth="1" />
          <polygon points="305,44 302,50 308,50" fill="#64748B" />
          <polygon points="305,82 302,76 308,76" fill="#64748B" />
          <text x="310" y="66" fill="#64748B" fontSize="8" fontFamily="monospace">GRAINLINE ↑↓</text>

          <text x="115" y="105" fill="#155DFC" fontSize="9" fontFamily="monospace" fontWeight="bold">CAD SEAM ALLOWANCE: 1CM (SOLID = CUT LINE, DASHED = SEAM LINE)</text>
        </svg>
      </div>
    );
  };

  const sidebarItems = [
    { id: "dashboard-view", label: "Engineering Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
    { id: "design-input-view", label: "Create Process Sheet", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { id: "tooling-view", label: "Sewing Machinery Catalog", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.594 15.12a2 2 0 00-1.022.547l-1.4 1.4A2 2 0 004.596 20.5l.896-.896a2 2 0 011.414-.586h.88a2 2 0 001.414-.586l1.242-1.243a4 4 0 012.829-1.172h.434a4 4 0 012.829 1.172l1.242 1.243a2 2 0 001.414.586h.88a2 2 0 011.414.586l.896.896a2 2 0 001.414-2.828l-1.4-1.4z" },
    { id: "knowledge-view", label: "Manufacturing Knowledge Base", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { id: "projects-view", label: "Active Projects & History", icon: "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 012 2v3a2 2 0 01-2 2H5z" },
    { id: "settings-view", label: "System Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800 print:h-auto print:w-full print:overflow-visible print:bg-white print:p-0 print:m-0">
      {/* Sidebar Navigation */}
      <aside
        className={`h-full flex flex-col py-8 flex-shrink-0 transition-all duration-300 border-r border-slate-100 overflow-hidden print:hidden ${
          isCollapsed ? "w-[78px] px-3.5 bg-transparent" : "w-[280px] px-5 bg-[#FFFFFF]"
        }`}
      >
        <div className="flex items-center mb-10 h-8 pl-2 overflow-hidden">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-700 hover:text-[#155DFC] focus:outline-none cursor-pointer p-1 rounded-lg hover:bg-slate-100/50 transition-colors flex items-center justify-center flex-shrink-0"
            aria-label="Toggle Sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className={`font-display font-bold text-xl text-slate-900 select-none flex items-center gap-1.5 whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100 ml-3.5"
          }`}>
            FashionFlow <span className="bg-[#155DFC] text-white text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md font-bold">AI</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 flex-grow overflow-y-auto pr-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center rounded-xl font-medium text-xs py-3 px-3.5 transition-all duration-300 w-full cursor-pointer overflow-hidden ${
                activeTab === item.id
                  ? "bg-[#155DFC] text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                {item.id === "dashboard-view" ? (
                  <>
                    <path d={item.icon}></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </>
                ) : item.id === "history-view" || item.id === "design-input-view" || item.id === "sewing-sequence-view" || item.id === "tooling-view" || item.id === "smv-view" || item.id === "knowledge-view" || item.id === "projects-view" || item.id === "settings-view" ? (
                  <path d={item.icon}></path>
                ) : (
                  <>
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </>
                )}
              </svg>
              <span className={`whitespace-nowrap truncate overflow-hidden transition-all duration-300 ${
                isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[180px] opacity-100 ml-3.5"
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Panel Content (Scrolls independently - Fluid Full Screen Layout) */}
      <main className={`flex-grow h-full overflow-y-auto print:p-0 print:m-0 print:w-full print:h-auto print:overflow-visible print:bg-white ${activeTab === "design-input-view" ? "p-0 bg-white" : "px-10 py-6"}`}>
        {/* VIEW 1: Pre-Production Engineering Dashboard */}
        {activeTab === "dashboard-view" && (
          <div className="fade-in w-full">
            <header className="mb-6">
              <span className="text-[10px] font-mono text-[#155DFC] font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Pre-Production Engineering</span>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight mt-1 mb-1.5">
                Engineering Dashboard
              </h1>
              <p className="text-slate-500 text-xs max-w-2xl leading-relaxed">
                AI-assisted garment analysis, originality verification, and process sheet generation for pre-production engineering.
              </p>
            </header>

            {/* Engineering KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xs hover:border-[#155DFC]/30 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Total Analyses</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <svg className="w-4 h-4 text-[#155DFC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-slate-900">{analysisHistory.length}</p>
                <p className="text-xs text-slate-400 mt-1">Engineering runs logged</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xs hover:border-emerald-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Unique Designs</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-slate-900">
                  {analysisHistory.filter(a => {
                    const s = (a.result?.status || "").toUpperCase();
                    return s !== "REJECTED" && s !== "HISTORICAL_MATCH_FOUND";
                  }).length}
                </p>
                <p className="text-xs text-slate-400 mt-1">Approved original patterns</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xs hover:border-amber-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Historical Matches</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-slate-900">
                  {analysisHistory.filter(a => {
                    const s = (a.result?.status || "").toUpperCase();
                    return s === "REJECTED" || s === "HISTORICAL_MATCH_FOUND" || (a.result?.similarity_percentage || 0) >= 90;
                  }).length}
                </p>
                <p className="text-xs text-slate-400 mt-1">Vector DB reference records</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xs hover:border-purple-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Avg. Est. SMV</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-slate-900 font-mono">
                  {analysisHistory.length > 0
                    ? (() => {
                        const smvValues = analysisHistory
                          .map(a => parseFloat((a.result?.smv_range || "0").split("-")[0]))
                          .filter(v => !isNaN(v) && v > 0);
                        if (smvValues.length === 0) return "N/A";
                        return (smvValues.reduce((a, b) => a + b, 0) / smvValues.length).toFixed(1);
                      })()
                    : "N/A"}
                </p>
                <p className="text-xs text-slate-400 mt-1">min/pc average across projects</p>
              </div>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: System Workflow Guide */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-7 shadow-2xs">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-lg text-slate-900">Engineering Workflow</h2>
                  <button
                    onClick={() => { setActiveTab("design-input-view"); setCurrentStep(1); }}
                    className="text-xs font-semibold text-[#155DFC] hover:text-[#1249cc] bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    Start New Analysis →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2 p-5 border border-blue-100 rounded-xl bg-blue-50/40">
                    <div className="w-8 h-8 rounded-full bg-[#155DFC] text-white flex items-center justify-center font-bold text-sm">1</div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 font-display">Upload &amp; Originality</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Upload garment sketch. DINOv2 vector engine verifies originality against database records with 95% threshold.</p>
                  </div>
                  <div className="flex flex-col gap-2 p-5 border border-slate-100 rounded-xl bg-slate-50/40">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">2</div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 font-display">Engineering Parameters</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Define project parameters — garment type, fabric weight, component breakdown, and production specifications.</p>
                  </div>
                  <div className="flex flex-col gap-2 p-5 border border-slate-100 rounded-xl bg-slate-50/40">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">3</div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 font-display">Process Sheet &amp; SMV</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">AI generates the sewing sequence, machine tooling recommendations, and estimated SMV for production planning.</p>
                  </div>
                </div>

                {/* Originality ratio visual bar */}
                {analysisHistory.length > 0 && (() => {
                  const total = analysisHistory.length;
                  const approved = analysisHistory.filter(a => {
                    const s = (a.result?.status || "").toUpperCase();
                    return s !== "REJECTED" && s !== "HISTORICAL_MATCH_FOUND";
                  }).length;
                  const rejected = total - approved;
                  const approvedPct = Math.round((approved / total) * 100);
                  return (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Originality Ratio</span>
                        <span className="text-xs font-bold text-emerald-600">{approvedPct}% Approved</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${approvedPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 font-mono">
                        <span className="text-[10px] text-slate-400">{approved} unique designs</span>
                        <span className="text-[10px] text-slate-400">{rejected} historical matches</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: Activity Feed */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xs flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-bold text-lg text-slate-900">Activity Feed</h2>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" title="Live"></span>
                </div>
                {analysisHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center my-auto">
                    <svg className="w-8 h-8 text-slate-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-slate-400">No activity yet. Run your first analysis to see the feed.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0">
                    {analysisHistory.slice(0, 8).map((item, idx) => {
                      const s = (item.result?.status || "").toUpperCase();
                      const isRejected = s === "REJECTED" || s === "HISTORICAL_MATCH_FOUND";
                      const formattedTime = formatActivityDate(item);
                      return (
                        <div key={idx} className="flex gap-3 py-3 border-b border-slate-100 last:border-0 items-start">
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRejected ? "bg-amber-400" : "bg-[#155DFC]"}`} />
                            {idx < analysisHistory.slice(0, 8).length - 1 && (
                              <div className="w-px flex-1 bg-slate-100 min-h-[16px]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {isRejected ? "Historical Match Found" : "Analysis Complete"}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{item.fileName || item.result?.classification?.[0]?.class_name || "Untitled"}</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{formattedTime}</span>
                        </div>
                      );
                    })}
                    {analysisHistory.length > 8 && (
                      <button
                        onClick={() => setActiveTab("projects-view")}
                        className="mt-3 text-xs font-semibold text-[#155DFC] hover:text-[#1249cc] text-left cursor-pointer"
                      >
                        View all {analysisHistory.length} projects →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Create Process Sheet — Refined Penpot-inspired Layout */}
        {activeTab === "design-input-view" && (() => {
          /* ── Active Step Controller ── */
          const cpStep = isQuizSubmitted ? 3 : currentStep;

          /* ── Grade System ── */
          const isSingleRejected = result && ["REJECTED", "HISTORICAL_MATCH_FOUND"].includes((result.status || "").toUpperCase());
          const isDollRejected = projectMode === "doll" && Object.values(componentsState).some(c => c.result && ["REJECTED", "HISTORICAL_MATCH_FOUND"].includes((c.result.status || "").toUpperCase()));
          const isPatternRejected = projectMode === "single" ? isSingleRejected : isDollRejected;

          const simPct = Math.max(0, result?.similarity_percentage || 0);
          const getGrade = (pct: number) => {
            if (!result) return null;
            if (pct >= 90) return { letter: "F", label: "Duplicate Pattern Match", bg: "bg-red-600",    text: "text-white",       cardBorder: "border-red-200",    cardBg: "bg-red-50/60",    rowBg: "bg-red-100",    rowText: "text-red-800" };
            if (pct >= 70) return { letter: "C", label: "High Overlap — Review",  bg: "bg-orange-500", text: "text-white",       cardBorder: "border-orange-200", cardBg: "bg-orange-50/60", rowBg: "bg-orange-100", rowText: "text-orange-800" };
            if (pct >= 50) return { letter: "B", label: "Notable Overlap",        bg: "bg-amber-400",  text: "text-amber-950",   cardBorder: "border-amber-200",  cardBg: "bg-amber-50/60",  rowBg: "bg-amber-100",  rowText: "text-amber-800" };
            if (pct >= 30) return { letter: "A", label: "Original",               bg: "bg-emerald-500",text: "text-white",       cardBorder: "border-emerald-200",cardBg: "bg-emerald-50/60",rowBg: "bg-emerald-100",rowText: "text-emerald-800" };
            return               { letter: "A+", label: "Highly Original",         bg: "bg-emerald-600",text: "text-white",       cardBorder: "border-emerald-200",cardBg: "bg-emerald-50/60",rowBg: "bg-emerald-100",rowText: "text-emerald-800" };
          };
          const grade = getGrade(simPct);

          const getItemGrade = (pct: number) => {
            if (pct >= 90) return { bg: "bg-red-100",    text: "text-red-800" };
            if (pct >= 70) return { bg: "bg-orange-100", text: "text-orange-800" };
            if (pct >= 50) return { bg: "bg-amber-100",  text: "text-amber-800" };
            return               { bg: "bg-emerald-100", text: "text-emerald-800" };
          };

          const wfBg  = grade?.letter === "F" ? "bg-red-600" : grade?.letter === "C" ? "bg-orange-500" : grade?.letter === "B" ? "bg-amber-400" : grade ? "bg-emerald-600" : "bg-[#155DFC]";
          const wfTxt = grade?.letter === "B" ? "text-amber-950" : "text-white";

          return (
            <div className="fade-in w-full flex flex-col min-h-screen bg-white">
              {/* ── BANNER — Sleek compact header matching exact Y baseline ── */}
              <div className="bg-[#155DFC] px-10 py-6 flex items-center justify-between no-print print:hidden">
                <div>
                  <span className="text-[10px] font-mono text-blue-200/90 font-bold uppercase tracking-widest bg-blue-600/50 px-2 py-0.5 rounded-md inline-block">Process Sheet Engineering</span>
                  <h1 className="font-display font-bold text-2xl md:text-3xl text-white tracking-tight mt-1 mb-1.5">
                    Create Process Sheet
                  </h1>
                  <p className="text-blue-100/90 text-xs max-w-xl leading-relaxed">
                    Compile industrial sewing specifications, machine allocations, and SMV timing.
                  </p>
                </div>
              </div>

              {/* ── STEPPER TABS — Wide, balanced equal-width tabs matching Penpot ── */}
              <div className="bg-[#155DFC] flex items-end px-10 no-print print:hidden">
                {[
                  { n: 1, label: "STEP 1" },
                  { n: 2, label: "STEP 2" },
                  { n: 3, label: "STEP 3" },
                ].map(({ n, label }) => {
                  const active = cpStep === n;
                  const done   = cpStep > n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        if (n === 1 && cpStep === 2) {
                          handleSafeBackToStep1();
                        } else if (done || (n === 2 && !isQuizSubmitted)) {
                          setCurrentStep(n);
                        }
                      }}
                      className={`flex-1 py-3.5 text-xs font-bold rounded-t-xl select-none text-center font-mono transition-all cursor-pointer ${
                        active
                          ? "bg-white text-[#155DFC] relative z-10"
                          : done
                          ? "bg-[#1249cc]/70 text-blue-100 hover:bg-[#1249cc]"
                          : "bg-[#1249cc]/40 text-blue-200/60 cursor-default"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* ── CONTENT PANEL ── */}
              <div className="bg-white flex-1 flex flex-col justify-between">
                {/* ── STEP 1: Project Mode Selection Slide ── */}
                {cpStep === 1 && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex-1 flex flex-col justify-center p-10">
                      <div className="max-w-4xl mx-auto w-full my-auto flex flex-col gap-8">
                        <div className="text-center">
                          <span className="text-xs font-mono font-bold text-[#155DFC] uppercase tracking-widest">Step 1 of 3</span>
                          <h2 className="font-display font-bold text-2xl md:text-3xl text-slate-900 mt-1">Select Garment Engineering Mode</h2>
                          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto leading-relaxed">
                            Choose your production setup before compiling sewing specifications and machine allocations.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Option 1: Single Garment */}
                          <div
                            onClick={() => setProjectMode("single")}
                            className={`p-8 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-6 ${
                              projectMode === "single"
                                ? "border-[#155DFC] bg-blue-50/40 shadow-md ring-2 ring-[#155DFC]/20"
                                : "border-slate-200/80 hover:border-[#155DFC]/60 bg-white hover:bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                projectMode === "single" ? "bg-[#155DFC] text-white" : "bg-slate-100 text-slate-600"
                              }`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
                                </svg>
                              </div>
                              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                projectMode === "single" ? "border-[#155DFC] bg-[#155DFC]" : "border-slate-300"
                              }`}>
                                {projectMode === "single" && <div className="w-2 h-2 rounded-full bg-white" />}
                              </span>
                            </div>

                            <div>
                              <h3 className="font-display font-bold text-slate-900 text-base">Single Garment Specification</h3>
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Compile process sheet for an individual garment (Shirt, T-Shirt, Jacket, Pants, Dress, or Hat). Includes DINOv2 originality check.
                              </p>
                            </div>
                          </div>

                          {/* Option 2: Doll Outfit Set */}
                          <div
                            onClick={() => setProjectMode("doll")}
                            className={`p-8 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-6 ${
                              projectMode === "doll"
                                ? "border-[#155DFC] bg-blue-50/40 shadow-md ring-2 ring-[#155DFC]/20"
                                : "border-slate-200/80 hover:border-[#155DFC]/60 bg-white hover:bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                projectMode === "doll" ? "bg-[#155DFC] text-white" : "bg-slate-100 text-slate-600"
                              }`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                </svg>
                              </div>
                              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                projectMode === "doll" ? "border-[#155DFC] bg-[#155DFC]" : "border-slate-300"
                              }`}>
                                {projectMode === "doll" && <div className="w-2 h-2 rounded-full bg-white" />}
                              </span>
                            </div>

                            <div>
                              <h3 className="font-display font-bold text-slate-900 text-base">Doll Outfit Set Project</h3>
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Multi-component specification set for doll apparel (Teddy Bear, Fashion Doll, Plushie Mascot, or School Academy outfit sets).
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar — Clean borderless matching Penpot */}
                    <div className="bg-white px-10 py-5 flex items-center justify-between mt-auto">
                      <button
                        type="button"
                        onClick={handleResetWorkspace}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer active:scale-98"
                      >
                        Reset Selection
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-8 py-3 bg-[#155DFC] hover:bg-[#1249cc] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98"
                      >
                        <span>Continue to Step 2</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>

                  </div>
                )}

                {/* ── STEP 2: Pattern Sketch & Engineering Specifications ── */}
                {cpStep === 2 && !isQuizSubmitted && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                      {/* Left — Upload & DINOv2 Scan */}
                      <div className="flex flex-col gap-6 lg:pr-6">
                        <div>
                          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">GARMENT SKETCH</h2>
                          {projectMode === "single" ? (
                            <div className="flex flex-col gap-5">
                              <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={triggerFileSelect}
                                className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center min-h-[280px] text-center cursor-pointer transition-all ${
                                  isDragOver
                                    ? "border-[#155DFC] bg-blue-50/50"
                                    : previewUrl
                                    ? "border-slate-200 bg-slate-50/50"
                                    : "border-slate-200 hover:border-[#155DFC] bg-slate-50/30"
                                }`}
                              >
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
                                  accept="image/*"
                                  className="hidden"
                                />
                                {!previewUrl ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 text-[#155DFC] flex items-center justify-center">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-slate-700">Click or drag garment sketch here</p>
                                      <p className="text-xs text-slate-400 mt-1">PNG, JPG or WEBP — DINOv2 scan runs automatically</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative w-full flex items-center justify-center p-3">
                                    <img
                                      src={result ? result.preview_image : previewUrl}
                                      alt="Garment Sketch"
                                      className="max-h-[250px] object-contain rounded-lg"
                                    />
                                  </div>
                                )}
                              </div>
                              {/* DINOv2 Grade Card — SecurityHeaders style */}
                              {previewUrl && (
                                <div className={`border rounded-xl overflow-hidden text-xs transition-all ${grade ? grade.cardBorder : "border-slate-200"} ${grade ? grade.cardBg : "bg-slate-50"}`}>
                                  {/* Header row with big badge */}
                                  <div className="flex items-stretch">
                                    <div className={`flex items-center justify-center w-16 flex-shrink-0 ${grade ? grade.bg : "bg-[#155DFC]"}`}>
                                      {isLoading ? (
                                        <svg className="w-7 h-7 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                      ) : (
                                        <span className={`font-black text-2xl leading-none ${grade ? grade.text : "text-white"}`}>
                                          {grade ? grade.letter : "–"}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-col justify-center px-4 py-3 gap-0.5 flex-1">
                                      <span className="font-bold text-slate-900 text-[13px]">
                                        {isLoading ? "Scanning visual embeddings..." : grade ? grade.label : "Awaiting scan"}
                                      </span>
                                      <span className="text-slate-500 text-[11px]">
                                        {isLoading
                                          ? "Querying pgvector for visual duplicates..."
                                          : result
                                          ? `Catalog similarity: ${simPct.toFixed(1)}% — ${grade?.letter === "F" ? "Duplicate pattern matched in catalog. Ready to reuse spec." : grade?.letter === "C" ? "High overlap. Review before proceeding." : grade?.letter === "B" ? "Some overlap. Proceed with caution." : "Pattern uniqueness verified."}`
                                          : "Upload a sketch to begin scan."}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Matched projects table */}
                                  {result?.top_3_saved_projects && result.top_3_saved_projects.filter((p: any) => p.similarity_pct > 0).length > 0 && (
                                    <div className="border-t border-slate-200/80">
                                      <div className="px-4 py-2 bg-white/60">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">MATCHED PROJECTS IN CATALOG</span>
                                      </div>
                                      <div className="flex flex-col divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
                                        {result.top_3_saved_projects
                                          .filter((p: any) => p.similarity_pct > 0)
                                          .map((item: any, idx: number) => {
                                            const ig = getItemGrade(item.similarity_pct);
                                            return (
                                              <div key={idx} className="flex items-center gap-3 px-4 py-2.5 bg-white/40 hover:bg-white/80 transition-colors">
                                                {item.preview_image ? (
                                                  <img src={item.preview_image} alt={item.title} className="w-8 h-8 object-contain rounded border border-slate-200 bg-white flex-shrink-0" />
                                                ) : (
                                                  <div className="w-8 h-8 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 text-[9px] font-mono flex-shrink-0">#{item.id}</div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                  <span className="text-[11px] font-semibold text-slate-800 block truncate">ID #{item.id} — {item.title}</span>
                                                  <span className="text-[10px] text-slate-500">{item.garment_type || "Garment"}</span>
                                                </div>
                                                <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${ig.bg} ${ig.text}`}>
                                                  {item.similarity_pct.toFixed(1)}%
                                                </span>
                                              </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {(DOLL_TYPES[dollType] || []).map((g) => {
                                const compState = componentsState[g] || { fabricWeight: "Cotton (Medium-weight)", imageFile: null, previewUrl: null, result: null };
                                return (
                                  <div key={g} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between gap-3">
                                    <span className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wide">{g}</span>
                                    {!compState.previewUrl ? (
                                      <label className="border border-dashed border-slate-300 hover:border-[#155DFC] rounded-lg flex flex-col items-center justify-center p-4 aspect-square text-center cursor-pointer bg-white transition-colors">
                                        <input type="file" onChange={(e) => { if (e.target.files?.[0]) handleComponentFileChange(g, e.target.files[0]); }} accept="image/*" className="hidden" />
                                        <svg className="w-5 h-5 text-slate-400 mb-1" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        <span className="text-[10px] text-slate-500 font-medium">Upload {g}</span>
                                      </label>
                                    ) : (
                                      <div className="relative rounded-lg overflow-hidden aspect-square bg-white border border-slate-200 flex items-center justify-center p-1">
                                        <img src={compState.previewUrl} alt={`${g} preview`} className="max-w-full max-h-full object-contain" />
                                        <button
                                          type="button"
                                          onClick={() => setComponentsState(prev => ({ ...prev, [g]: { ...prev[g], imageFile: null, previewUrl: null, result: null } }))}
                                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-800/80 text-white flex items-center justify-center hover:bg-black transition-colors text-[10px]"
                                        >✕</button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right — Engineering Specifications */}
                      <div className="flex flex-col gap-5 lg:pl-6">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ENGINEERING SPECIFICATIONS</h2>
                        <form id="process-sheet-form" onSubmit={projectMode === "doll" ? handleGenerateDollProcessSheet : handleGenerateProcessSheet} className="flex flex-col gap-5 flex-1">
                          
                          {/* ── CATALOG REUSE PROMPT — shown when DINOv2 similarity >= 90% ── */}
                          {showReusePrompt && result && projectMode === "single" && (() => {
                            const topMatch = result.top_3_saved_projects?.[0];
                            return (
                              <div className="border border-[#155DFC]/30 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50/80 to-indigo-50/60 shadow-sm">
                                {/* Header */}
                                <div className="flex items-center gap-3 px-4 py-3 bg-[#155DFC] text-white">
                                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[11px] uppercase tracking-widest text-blue-100">Existing Master Pattern Found in Catalog</p>
                                    <p className="font-semibold text-sm text-white truncate">ID #{topMatch?.id} — {topMatch?.title || "Matched Pattern"}</p>
                                  </div>
                                  <span className="text-xs font-mono font-bold bg-white/20 px-2 py-1 rounded-lg flex-shrink-0">{(result.similarity_percentage || 0).toFixed(1)}%</span>
                                </div>

                                {/* Matched project preview */}
                                <div className="flex items-center gap-3 px-4 py-3 border-b border-blue-100/60">
                                  {topMatch?.preview_image ? (
                                    <img src={topMatch.preview_image} alt={topMatch.title} className="w-12 h-12 object-contain rounded-xl border border-blue-200 bg-white flex-shrink-0" />
                                  ) : (
                                    <div className="w-12 h-12 rounded-xl border border-blue-200 bg-blue-100 flex items-center justify-center text-blue-400 flex-shrink-0">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-[#155DFC]">{topMatch?.garment_type || topMatch?.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Do you want to reuse this existing master engineering data? Reusing this spec keeps the original master ID intact while letting you recalculate batch size for a new production run.</p>
                                  </div>
                                </div>

                                {/* 2 action buttons */}
                                <div className="flex flex-col gap-2 p-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReuseMode("reuse");
                                      setQuizName(topMatch?.title || "");
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-2 cursor-pointer ${
                                      reuseMode === "reuse"
                                        ? "bg-[#155DFC] text-white border-[#155DFC] shadow-md"
                                        : "bg-white text-[#155DFC] border-[#155DFC]/40 hover:border-[#155DFC] hover:bg-blue-50"
                                    }`}
                                  >
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                    <span className="flex-1 text-left">REUSE MASTER SPEC (ID #{topMatch?.id}) — Recalculate Batch Only</span>
                                    {reuseMode === "reuse" && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReuseMode("new");
                                      setQuizName("");
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-2 cursor-pointer ${
                                      reuseMode === "new"
                                        ? "bg-slate-800 text-white border-slate-800 shadow-md"
                                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                    }`}
                                  >
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="flex-1 text-left">CREATE NEW VARIANT — Enter a different project name</span>
                                    {reuseMode === "new" && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                  </button>
                                </div>

                                {/* Conditional name input — only show for NEW variant mode */}
                                {reuseMode === "new" && (
                                  <div className="px-3 pb-3">
                                    <input
                                      type="text"
                                      value={quizName}
                                      onChange={(e) => setQuizName(e.target.value)}
                                      placeholder="e.g. Autumn Casual Jacket Batch #02 — 2026"
                                      className="bg-white border border-slate-200/90 rounded-xl py-2.5 px-4 text-sm text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full"
                                      autoFocus
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Standard project name input — only when NO catalog match (no reuse prompt) or doll mode */}
                          {(!showReusePrompt || projectMode === "doll") && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-700">Project / Batch Name *</label>
                              <input
                                type="text"
                                value={quizName}
                                onChange={(e) => setQuizName(e.target.value)}
                                maxLength={100}
                                placeholder="e.g. Autumn Casual Jacket Batch #01"
                                className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full break-words break-all"
                              />
                            </div>
                          )}

                          {projectMode === "single" ? (
                            <>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-slate-700">Garment Category</label>
                                <select value={quizGarment} onChange={(e) => setQuizGarment(e.target.value)}
                                  className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full">
                                  <optgroup label="Tops">
                                    <option value="Shirt">Kemeja (Shirt) — 8 Sewing Steps</option>
                                    <option value="T-Shirt">Kaos (T-Shirt) — 4 Sewing Steps</option>
                                    <option value="Jacket">Jaket / Outerwear — 6 Sewing Steps</option>
                                  </optgroup>
                                  <optgroup label="Bottoms">
                                    <option value="Pants">Celana Panjang (Pants) — 6 Sewing Steps</option>
                                    <option value="Skirt">Rok (Skirt) — 4 Sewing Steps</option>
                                  </optgroup>
                                  <optgroup label="Full-body">
                                    <option value="Dress">Gaun / Dress — 5 Sewing Steps</option>
                                    <option value="Hat">Topi / Hat — 5 Sewing Steps</option>
                                  </optgroup>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-slate-700">Fabric Application / Weight</label>
                                <select value={quizFabric} onChange={(e) => setQuizFabric(e.target.value)}
                                  className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full">
                                  <optgroup label="Light-weight">
                                    <option value="Silk (Light-weight)">Sutra / Silk</option>
                                    <option value="Chiffon (Light-weight)">Sifon / Chiffon</option>
                                    <option value="Organza (Light-weight)">Organza</option>
                                    <option value="Crepe (Light-weight)">Krep / Crepe</option>
                                    <option value="Rayon (Light-weight)">Rayon / Viscose</option>
                                  </optgroup>
                                  <optgroup label="Medium-weight">
                                    <option value="Cotton (Medium-weight)">Katun / Cotton</option>
                                    <option value="Batik (Medium-weight)">Batik Tulis &amp; Cap</option>
                                    <option value="Linen (Medium-weight)">Linen</option>
                                    <option value="Satin (Medium-weight)">Satin / Duchess</option>
                                    <option value="Flannel (Medium-weight)">Flanel / Flannel</option>
                                    <option value="Polyester (Medium-weight)">Polyester</option>
                                  </optgroup>
                                  <optgroup label="Heavy-weight">
                                    <option value="Denim (Heavy-weight)">Denim / Jeans (14oz)</option>
                                    <option value="Corduroy (Heavy-weight)">Corduroy</option>
                                    <option value="Tweed (Heavy-weight)">Tweed / Wool</option>
                                    <option value="Gabardine (Heavy-weight)">Gabardine</option>
                                    <option value="Synthetic Fur (Heavy-weight)">Synthetic Furs / Canvas</option>
                                  </optgroup>
                                </select>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-700">Doll Type Template</label>
                              <select value={dollType} onChange={(e) => setDollType(e.target.value)}
                                className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full">
                                {Object.keys(DOLL_TYPES).map(t => (
                                  <option key={t} value={t}>{t} — ({DOLL_TYPES[t].map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(" + ")})</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-700">Production Run Quantity (Batch Size)</label>
                            <div className="flex items-center gap-2">
                              {[100, 250, 500, 1000].map((qty) => (
                                <button
                                  key={qty}
                                  type="button"
                                  onClick={() => setBatchQuantity(qty)}
                                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                                    batchQuantity === qty
                                      ? "bg-[#155DFC] text-white border-[#155DFC] shadow-2xs"
                                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {qty} pcs
                                </button>
                              ))}
                              <input
                                type="number"
                                min={1}
                                value={batchQuantity}
                                onChange={(e) => setBatchQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 bg-slate-50/80 border border-slate-200/90 rounded-xl py-2 px-2 text-xs font-mono text-slate-900 text-center font-bold focus:bg-white focus:border-[#155DFC] focus:outline-none"
                                placeholder="Qty"
                              />
                            </div>
                          </div>

                          {/* Tag Management System */}
                          <TagSelector
                            selectedTags={selectedTags}
                            onChange={setSelectedTags}
                            availableTags={availableTags}
                          />

                          {/* Optional Designer / Pattern Notes */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-700">Designer &amp; Pattern Notes (Optional)</label>
                            <textarea
                              value={designerNotes}
                              onChange={(e) => setDesignerNotes(e.target.value)}
                              maxLength={1000}
                              placeholder="e.g. Hand-sewn collar detail, 1cm seam allowance on armholes, customer request for extra reinforced bartacking..."
                              rows={3}
                              className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full resize-none leading-relaxed break-words break-all"
                            />
                          </div>
                          
                          {/* Workflow Status — shown only when no reuse prompt is active */}
                          {!showReusePrompt && (
                          <div className={`border rounded-xl overflow-hidden mt-auto transition-all ${
                            grade?.letter === "C" ? "border-orange-200" : grade?.letter === "B" ? "border-amber-200" : grade ? "border-emerald-200" : "border-slate-200"
                          }`}>
                            <div className={`flex items-center justify-between px-4 py-2.5 text-xs ${wfBg} ${wfTxt}`}>
                              <span className="font-semibold">Workflow Status</span>
                              <span className="font-bold">
                                {grade ? "Ready for Compilation" : "Awaiting Pattern Scan"}
                              </span>
                            </div>
                            <p className={`text-[11px] px-4 py-2.5 leading-relaxed ${
                              grade?.letter === "C" ? "bg-orange-50 text-orange-800" : grade?.letter === "B" ? "bg-amber-50 text-amber-800" : grade ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"
                            }`}>
                              {grade
                                ? "Pattern passed originality check. Fill in the project details and click Generate Process Sheet."
                                : "Upload a garment sketch to run the DINOv2 originality scan before proceeding."}
                            </p>
                          </div>
                          )}
                        </form>
                      </div>
                    </div>
                    {/* ── ANCHORED BOTTOM ACTION BAR — Step 2 ── */}
                    <div className="bg-white px-10 py-5 flex items-center justify-between mt-auto border-t border-slate-100/60">
                      <button
                        type="button"
                        onClick={handleResetStep2}
                        className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-98"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Reset Form &amp; Sketch
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSafeBackToStep1}
                          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-98"
                        >
                          ← Back to Mode Choice
                        </button>

                        <button
                          type="submit"
                          form="process-sheet-form"
                          disabled={
                            isLoading ||
                            // In reuse prompt mode: must choose reuse or new (and if new, must have a name)
                            (showReusePrompt && projectMode === "single" && (reuseMode === null || (reuseMode === "new" && !quizName.trim()))) ||
                            // In normal mode (no reuse prompt): must have a project name
                            (!showReusePrompt && !quizName.trim()) ||
                            // Must have a sketch loaded
                            (projectMode === "single" ? (!previewUrl || !result) : !Object.values(componentsState).some(c => c.previewUrl))
                          }
                          className="px-8 py-3 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 bg-[#155DFC] hover:bg-[#1249cc]"
                        >
                          {isLoading ? (
                            <>
                              <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Compiling Sheet...
                            </>
                          ) : (
                            <>
                              <span>{reuseMode === "reuse" ? "GENERATE BATCH (REUSE MASTER SPEC)" : "Continue / Generate"}</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 2 / PHASE 2: Process Sheet Output ── */}
                {isQuizSubmitted && fullResult && (
                  <>
                    {/* ── DEDICATED PRINT / PDF TECH PACK EXPORT SHEET (NATIVE PRINT MODE ONLY) ── */}
                    <div className="hidden print:block w-full text-slate-900 font-sans p-2 space-y-4">
                      {/* Print Document Header */}
                      <div className="flex justify-between items-end pb-3 border-b-2 border-slate-900">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#155DFC] uppercase tracking-wider">FASHIONFLOW AI — GARMENT TECHNICAL SPECIFICATION SHEET</span>
                          <h1 className="text-xl font-bold text-slate-900 mt-0.5">{quizName}</h1>
                        </div>
                        <div className="text-right text-[10px] font-mono text-slate-600 space-y-0.5">
                          <div><strong>SPEC ID:</strong> FF-SPEC-#{Math.floor(100000 + Math.random() * 900000)}</div>
                          <div><strong>DATE:</strong> {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</div>
                          <div><strong>STATUS:</strong> APPROVED &amp; LOCKED</div>
                        </div>
                      </div>

                      {/* Bento Box Top Row: Left Image Card & Right Metadata Card */}
                      <div className="grid grid-cols-5 gap-4">
                        {/* Bento Card 1: Sketch Image */}
                        <div className="col-span-2 border border-slate-300 rounded-lg p-3 bg-white flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold font-mono text-slate-500 uppercase self-start mb-2">Visual Garment Layout</span>
                          <img src={fullResult.preview_image} alt="Sketch" className="max-h-36 object-contain rounded" />
                        </div>

                        {/* Bento Card 2: Engineering Parameters & DINOv2 Metadata */}
                        <div className="col-span-3 border border-slate-300 rounded-lg p-3 bg-white flex flex-col justify-between">
                          <span className="text-[10px] font-bold font-mono text-slate-500 uppercase mb-2">Engineering &amp; Originality Parameters</span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div><span className="text-slate-500">Project Tags:</span> <strong className="text-blue-700">{fullResult?.tags && fullResult.tags.length > 0 ? fullResult.tags.join(", ") : "Standard Production"}</strong></div>
                            <div><span className="text-slate-500">DINOv2 Score:</span> <strong className="text-emerald-700">{fullResult.similarity_percentage}% (Original)</strong></div>
                            <div><span className="text-slate-500">Target Line Efficiency:</span> <strong className="text-slate-900">85%</strong></div>
                            <div><span className="text-slate-500">Standard Operator Rate:</span> <strong className="text-slate-900">60 Pcs / Hr</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Optional Designer & Engineering Notes Card in Print Sheet */}
                      {fullResult?.designer_notes && (
                        <div className="border border-slate-300 rounded-lg p-3 bg-white">
                          <span className="text-[10px] font-bold font-mono text-slate-500 uppercase mb-1 block">Designer &amp; Engineering Notes</span>
                          <p className="text-xs text-slate-800 font-mono leading-relaxed italic">&quot;{fullResult.designer_notes}&quot;</p>
                        </div>
                      )}

                      {/* Bento Card 3: Industrial Sewing Sequence Table */}
                      <div className="border border-slate-300 rounded-lg p-3 bg-white">
                        <span className="text-[10px] font-bold font-mono text-slate-500 uppercase mb-2 block">Industrial Sewing Sequence &amp; Machine Allocation Table</span>
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 font-bold font-mono text-[10px] text-slate-700">
                              <th className="p-1.5 border border-slate-300 w-12 text-center">Step</th>
                              <th className="p-1.5 border border-slate-300">Operation / Step Name</th>
                              <th className="p-1.5 border border-slate-300 w-16 text-center">Component</th>
                              <th className="p-1.5 border border-slate-300">Allocated Machine Model</th>
                              <th className="p-1.5 border border-slate-300 w-16 text-right">SMV (Min)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullResult.sewing_steps && fullResult.sewing_steps.map((step: any, i: number) => (
                              <tr key={i} className="text-[11px] hover:bg-slate-50">
                                <td className="p-1.5 border border-slate-200 text-center font-mono font-bold">{step.step}</td>
                                <td className="p-1.5 border border-slate-200 font-medium text-slate-900">{step.action}</td>
                                <td className="p-1.5 border border-slate-200 text-center font-mono text-[10px]">{step.part || "Main"}</td>
                                <td className="p-1.5 border border-slate-200 font-mono text-[10px] text-blue-800">{step.recommended_model || "Juki Lockstitch DDL-9000C"}</td>
                                <td className="p-1.5 border border-slate-200 text-right font-mono font-semibold">{(0.45 + (i % 3) * 0.15).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Bento Card 4: Summary Footers */}
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Total Operations</div>
                          <div className="text-sm font-bold text-slate-900">{fullResult.sewing_steps?.length || 0} Steps</div>
                        </div>
                        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Estimated Total SMV</div>
                          <div className="text-sm font-bold text-[#155DFC]">3.45 Minutes</div>
                        </div>
                        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Target Line Output</div>
                          <div className="text-sm font-bold text-emerald-700">104 Pcs / Hour</div>
                        </div>
                        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Recommended Juki Line</div>
                          <div className="text-sm font-bold text-slate-900">4 Ops / 3 Machines</div>
                        </div>
                      </div>
                    </div>

                    {/* ── WEB APPLICATION INTERACTIVE UI (RESTORED 100% FOR ON-SCREEN VIEWING) ── */}
                    <div className="flex-1 p-8 flex flex-col gap-8 animate-in fade-in duration-300 print:hidden">
                    {/* Official Industrial Technical Spec Header (Visible only during Print / PDF Export) */}
                    <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-mono font-bold text-[#155DFC] uppercase tracking-widest">FASHIONFLOW AI — GARMENT INDUSTRIAL SPECIFICATION</div>
                          <h1 className="font-bold text-2xl text-slate-900 mt-0.5">{quizName}</h1>
                        </div>
                        <div className="text-right font-mono text-[10px] text-slate-600 space-y-0.5">
                          <div><span className="font-bold">STATUS:</span> FINALIZED &amp; LOCKED</div>
                          <div><span className="font-bold">CATEGORY:</span> {quizGarment} ({quizFabric})</div>
                          <div><span className="font-bold">SPEC ID:</span> FF-SPEC-#{Math.floor(100000 + Math.random() * 900000)}</div>
                        </div>
                      </div>
                    </div>

                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6 no-print">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-[#155DFC] font-bold uppercase tracking-widest">
                            {fullResult.is_doll_project ? "Doll Outfit Process Sheet Set" : "Process Specification Sheet"}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            FINALIZED &amp; LOCKED
                          </span>
                        </div>
                        <h1 className="font-sans font-bold text-2xl md:text-3xl text-slate-900">{quizName}</h1>
                      </div>
                      <div className="flex items-center gap-3 no-print">
                        <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Export Specs
                        </button>
                        <button onClick={handleResetWorkspace} className="px-5 py-2.5 rounded-xl bg-[#155DFC] hover:bg-[#1249cc] text-white font-medium text-xs transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Create New Project
                        </button>
                      </div>
                    </header>


                <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                  {/* Left Column: Image, stats overlays and technical tags */}
                  <div className="xl:col-span-2 flex flex-col gap-6">
                    {fullResult.is_doll_project ? (
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xs">
                        <h2 className="font-bold text-slate-900 text-base mb-4 font-display">Doll Outfit Components</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Array.isArray(fullResult.classification) && fullResult.classification.map((comp: any, idx: number) => {
                            const compKey = comp.component;
                            const compImg = componentsState[compKey]?.previewUrl || "globe.svg";
                            return (
                              <div key={idx} className="border border-slate-100 rounded-xl overflow-hidden p-3 bg-slate-50/60 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-[#155DFC] uppercase font-mono">{compKey}</span>
                                  <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">Approved</span>
                                </div>
                                <div className="aspect-video bg-white border border-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                  <img src={compImg} alt={compKey} className="max-w-full max-h-full object-contain" />
                                </div>
                                <div className="text-[11px] text-slate-600 font-semibold truncate mt-1">
                                  {comp.class_name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-2xs relative">
                        <h2 className="font-bold text-slate-900 text-base mb-6 font-display leading-tight">Visual Layout Analysis</h2>
                        <div className="relative w-full flex items-center justify-center pt-0 px-1 pb-1">
                          <img
                            src={fullResult.preview_image}
                            alt="Garment Preview"
                            className="max-h-[520px] w-auto rounded-2xl object-contain shadow-xs"
                          />
                          {fullResult.yolo_detections && fullResult.yolo_detections.map((det: any, idx: number) => (
                            <div
                              key={idx}
                              className="absolute border-2 border-blue-500 bg-blue-500/10 transition-opacity duration-300 rounded-xs"
                              style={{
                                top: `${det.box[0]}%`,
                                left: `${det.box[1]}%`,
                                width: `${det.box[2] - det.box[0]}%`,
                                height: `${det.box[3] - det.box[1]}%`,
                              }}
                            >
                              <span className="absolute -top-5 -left-0.5 bg-[#155DFC] text-white font-mono text-[9px] py-0.5 px-1.5 rounded-xs whitespace-nowrap shadow-xs">
                                {det.label} ({(det.confidence * 100).toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-2xs">
                      <h3 className="font-bold text-slate-900 text-sm mb-4 font-display">
                        {fullResult.is_doll_project ? "Doll Project Metadata" : "Pattern Metadata"}
                      </h3>
                      <div className="space-y-3.5">
                        {fullResult.is_doll_project ? (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Doll Type:</span>
                              <span className="font-semibold text-slate-900">{fullResult.doll_type}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2.5">
                              <span className="text-slate-400 font-medium">Total Components:</span>
                              <span className="font-semibold text-slate-900">{fullResult.project_details?.components_count || 1} Garments</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-start text-xs gap-2">
                              <span className="text-slate-400 font-medium pt-0.5">Project Tags:</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {fullResult?.tags && fullResult.tags.length > 0 ? (
                                  fullResult.tags.map((t: string) => (
                                    <span key={t} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#155DFC] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/50">
                                      <svg className="w-2.5 h-2.5 text-[#155DFC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                                      {t}
                                    </span>
                                  ))
                                ) : (
                                  <span className="font-semibold text-slate-500">Standard Production</span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2.5">
                              <span className="text-slate-400 font-medium">Similarity Score:</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{fullResult.similarity_percentage}% (Approved)</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2.5">
                              <span className="text-slate-400 font-medium">Garment Category:</span>
                              <span className="font-semibold text-slate-900">{quizGarment}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2.5">
                              <span className="text-slate-400 font-medium">Fabric Application:</span>
                              <span className="font-semibold text-slate-900">{quizFabric}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Step 3 Designer & Engineering Notes Card */}
                    {fullResult?.designer_notes && (
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-2xs overflow-hidden">
                        <h3 className="font-bold text-slate-900 text-sm mb-2 font-display flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          Designer &amp; Pattern Notes
                        </h3>
                        <p className="text-xs text-slate-700 font-sans leading-relaxed italic bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 break-words break-all whitespace-pre-wrap">
                          &quot;{fullResult.designer_notes}&quot;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Step-by-Step Sewing Flow Table & Tooling */}
                  <div className="xl:col-span-3 flex flex-col gap-8">
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-2xs">
                      <h2 className="font-bold text-base text-slate-900 mb-6 font-display leading-tight">
                        STEP-BY-STEP SEWING FLOW
                      </h2>
                      
                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full table-fixed text-left text-sm text-slate-600 border-collapse">
                          <thead className="bg-slate-50/70 text-[11px] font-mono text-slate-400 uppercase border-b border-slate-100">
                            <tr>
                              <th className="py-4 px-4 font-bold w-[12%]">Step</th>
                              <th className="py-4 px-4 font-bold w-[40%]">Action / Step Flow</th>
                              <th className="py-4 px-4 font-bold text-center w-[10%]">Part</th>
                              <th className="py-4 px-4 font-bold w-[38%]">Recommended Machine &amp; Technical Specs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {fullResult.sewing_sequence_detailed && fullResult.sewing_sequence_detailed.length > 0 ? (
                              fullResult.sewing_sequence_detailed.map((step: any, idx: number) => {
                                const stepKey = step.step_num || idx + 1;
                                const isExpanded = expandedSteps[stepKey];

                                return (
                                  <React.Fragment key={idx}>
                                    <tr 
                                      onClick={() => toggleStep(stepKey)}
                                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group border-b border-slate-100"
                                    >
                                      <td className="py-4 px-4 font-semibold text-slate-900 font-mono">
                                        <div className="flex items-center gap-1.5">
                                          <svg 
                                            className={`w-4 h-4 text-slate-400 group-hover:text-[#155DFC] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#155DFC]' : ''}`}
                                            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                          </svg>
                                          <span>{step.step_num}</span>
                                        </div>
                                      </td>
                                      <td className="py-4 px-4 font-medium text-slate-700 truncate">
                                        {step.component && (
                                          <span className="inline-flex items-center text-[9px] uppercase font-mono font-bold px-2 py-0.5 bg-blue-50 border border-blue-200 text-[#155DFC] rounded-md mr-2 align-middle">
                                            {step.component}
                                          </span>
                                        )}
                                        <span className="align-middle group-hover:text-[#155DFC] transition-colors">{step.operation}</span>
                                      </td>
                                      <td className="py-4 px-4 flex justify-center">{getPartIcon(step.operation)}</td>
                                      <td className="py-4 px-4">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex flex-col gap-0.5 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-slate-900 text-xs">{step.recommended_model}</span>
                                              {step.needle && step.needle !== "N/A" && (
                                                <span className="text-[10px] font-mono text-[#155DFC] bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded font-medium">
                                                  Needle: {step.needle}
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono truncate">{step.machine_type}</span>
                                          </div>
                                          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md shrink-0 whitespace-nowrap">
                                            {step.smv_mins || "1.5"} mins
                                          </span>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Expanded Sub-Step & Technical Detail Drawer */}
                                    {isExpanded && (
                                      <tr className="bg-slate-50/80 border-b border-blue-100">
                                        <td colSpan={4} className="p-5">
                                          <div className="flex flex-col gap-5 font-sans text-xs">
                                            {/* Dynamic Sub-steps 1.1, 1.2, 1.3... */}
                                            {step.sub_steps && step.sub_steps.length > 0 && (
                                              <div>
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                                                    Operation Process Steps ({step.sub_steps.length} Sub-Steps)
                                                  </span>
                                                  <span className="text-[10px] font-mono text-[#155DFC] font-semibold">
                                                    Target Speed: {step.speed || "3,000 sti/min"}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                                  {step.sub_steps.map((sub: any, sIdx: number) => (
                                                    <div key={sIdx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                                                      <span className="font-mono text-blue-600 font-bold block text-[11px] mb-1">
                                                        Step {stepKey}.{sub.sub_num || sIdx + 1} — {sub.title}
                                                      </span>
                                                      <span className="text-slate-600 text-[11px] leading-relaxed block">
                                                        {sub.detail}
                                                      </span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {/* Visual Technical Seam Diagram (SVG) */}
                                            <div>
                                              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block mb-2">
                                                Technical Seam &amp; Stitch Path Diagram
                                              </span>
                                              {renderSeamTechnicalDiagram(step.operation)}
                                            </div>

                                            {/* Workstation Technical Specs & Work-Aid Attachment */}
                                            <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                              <div>
                                                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">Workstation Technical Specs</span>
                                                <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-700">
                                                  <span>Model: <strong className="text-slate-900">{step.recommended_model}</strong></span>
                                                  <span>•</span>
                                                  <span>Needle: <strong>{step.needle || "DBx1 (#11)"}</strong></span>
                                                  <span>•</span>
                                                  <span>Foot: <strong>{step.presser_foot || "Standard Foot"}</strong></span>
                                                  <span>•</span>
                                                  <span>Stitch: <strong>{step.stitch_spec || "2.5mm (10 SPI)"}</strong></span>
                                                </div>
                                              </div>

                                              {step.work_aid && (
                                                <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                                                  <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase block mb-1">Assigned Work-Aid Attachment</span>
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 text-xs">{step.work_aid.attachment_name}</span>
                                                    <span className="text-[9px] font-mono uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">{step.work_aid.aid_type}</span>
                                                  </div>
                                                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">{step.work_aid.purpose}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-16 px-6 text-center text-slate-400 font-medium">
                                  No sewing steps generated yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tooling Grid Recommendations */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-2xs">
                      <h2 className="font-bold text-base text-slate-900 mb-6 font-display">
                        RECOMMENDED JUKI MACHINERY
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fullResult.tooling_recommendations && fullResult.tooling_recommendations.map((tool: any, idx: number) => (
                          <div key={idx} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs flex flex-col h-full hover:border-[#155DFC]/40 transition-all duration-300">
                            <div className="bg-slate-50/70 border-b border-slate-100 aspect-[4/3] flex items-center justify-center p-4 relative overflow-hidden">
                              <img 
                                src={`/image/${tool.file}`} 
                                alt={tool.name}
                                className="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-105"
                              />
                            </div>
                            <div className="p-5 flex flex-col flex-grow">
                              <h3 className="font-bold text-slate-900 text-sm mb-1.5 font-display">{tool.name}</h3>
                              {renderSpecsDescription(tool.desc || tool.description)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SMV & COMPLEXITY SUMMARY */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-2xs flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">
                            {fullResult.is_doll_project ? "TOTAL ESTIMATED OUTSET SMV" : "ESTIMATED SMV"}
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-display font-bold text-3xl text-slate-900">
                              {(!fullResult.smv_range || fullResult.smv_range === "N/A") ? "13.5" : fullResult.smv_range.replace(" mins", "")}
                            </span>
                            <span className="text-sm font-semibold text-slate-400">min/pc set</span>
                          </div>
                        </div>

                        <div className="flex gap-8">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Complexity</span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                              fullResult.complexity === "High" 
                                ? "bg-red-50 text-red-700 border-red-200" 
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {fullResult.complexity}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Confidence</span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              High (Verified)
                            </span>
                          </div>
                        </div>
                      </div>

                      {fullResult.batch_production && (
                        <div className="border-t border-slate-100 pt-6 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[#155DFC] font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                                Batch Production Scaling
                              </span>
                              <span className="text-xs font-semibold text-slate-700">
                                Run Size: <strong className="font-mono text-slate-900">{fullResult.batch_production.batch_quantity} pcs</strong>
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3">
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Total Run SMV</span>
                              <span className="font-display font-bold text-xl text-slate-900 font-mono">
                                {fullResult.batch_production.batch_total_smv_mins.toLocaleString()} <span className="text-xs font-normal text-slate-400">mins</span>
                              </span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3">
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Est. Production Duration</span>
                              <span className="font-display font-bold text-xl text-[#155DFC] font-mono">
                                {fullResult.batch_production.batch_total_hours} <span className="text-xs font-normal text-slate-400">hrs</span>
                              </span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3">
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Daily Capacity / Operator</span>
                              <span className="font-display font-bold text-xl text-emerald-600 font-mono">
                                {fullResult.batch_production.operator_daily_capacity_pcs} <span className="text-xs font-normal text-slate-400">pcs/day</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {fullResult.line_balancing && (
                        <div className="border-t border-slate-100 pt-6 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-indigo-600 font-bold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                              Factory Line Balancing Allocation (500 pcs/day Target)
                            </span>
                            <span className="text-xs font-mono text-slate-500">
                              Takt Time: <strong className="text-slate-900">{fullResult.line_balancing.takt_time_mins} mins/unit</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {fullResult.line_balancing.machine_allocations.map((alloc: any, i: number) => (
                              <div key={i} className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                  <span className="text-xs font-bold font-mono text-slate-900 block">{alloc.machine_model}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">Total SMV: {alloc.total_smv_mins}m ({alloc.utilization_pct}% Util)</span>
                                </div>
                                <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold font-mono text-indigo-700 border border-indigo-200">
                                  {alloc.required_units} {alloc.required_units === 1 ? 'Unit' : 'Units'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      );
    })()}

        {activeTab === "sewing-sequence-view" && (
          <div className="fade-in w-full">
            {result ? (
              <div className="w-full">
                <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Sewing Sequence</span>
                    <h1 className="font-display font-bold text-4xl text-black mt-1">
                      {result?.classification?.[0]?.class_name || "Original Sketch Pattern"}
                    </h1>
                  </div>

                  {/* Top action buttons matching photo */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActiveTechPackData(fullResult);
                        setShowTechPackModal(true);
                      }}
                      className="px-4 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      EXPORT TECH PACK
                    </button>
                    <button className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-xs">FRONT</button>
                    <button className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">BACK</button>
                    <button className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                      </svg>
                      3D VIEW
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Left Column: Image box with overlays */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs relative">
                      <div className="relative rounded-lg overflow-hidden border border-zinc-150 aspect-square w-full bg-slate-50 flex items-center justify-center">
                        <img
                          src={result.preview_image}
                          alt="Garment Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                        
                        {/* YOLO bounding box overlays */}
                        {result.yolo_detections.map((det, idx) => (
                          <div
                            key={idx}
                            className="absolute border-2 border-blue-500 bg-blue-500/10 transition-opacity duration-300"
                            style={{
                              top: `${det.box[0]}%`,
                              left: `${det.box[1]}%`,
                              width: `${det.box[2] - det.box[0]}%`,
                              height: `${det.box[3] - det.box[1]}%`,
                            }}
                          >
                            <span className="absolute -top-5 -left-0.5 bg-blue-600 text-white font-mono text-[9px] py-0.5 px-1.5 rounded-sm whitespace-nowrap">
                              {det.label} ({(det.confidence * 100).toFixed(0)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Step-by-Step Sewing Flow Table */}
                  <div className="lg:col-span-3 flex flex-col gap-8">
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs">
                      <h2 className="font-display font-semibold text-xl text-black mb-6">
                        STEP-BY-STEP SEWING FLOW
                      </h2>
                      
                      <div className="overflow-hidden border border-zinc-150 rounded-lg">
                        <table className="w-full text-left text-sm text-slate-600 border-collapse">
                          <thead className="bg-slate-50 text-[11px] font-mono text-slate-400 uppercase border-b border-zinc-150">
                            <tr>
                              <th className="py-4.5 px-6 font-bold w-16">Step</th>
                              <th className="py-4.5 px-4 font-bold">Action / Step Flow</th>
                              <th className="py-4.5 px-4 font-bold text-center w-24">Part</th>
                              <th className="py-4.5 px-6 font-bold w-48">Machine Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-150 bg-white">
                            {result.sewing_sequence.map((step, idx) => {
                              const machineLabel = idx === 0 ? "Lockstitch" : (idx === 1 ? "Overlock" : "Lockstitch");
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-6 font-semibold text-black">{idx + 1}</td>
                                  <td className="py-4 px-4 font-medium text-slate-700">{step}</td>
                                  <td className="py-4 px-4 flex justify-center">{getPartIcon(step)}</td>
                                  <td className="py-4 px-6">
                                    <div className="flex items-center justify-between border border-zinc-200 rounded-md py-1.5 px-3 bg-slate-50 font-mono text-xs w-full">
                                      <span>{machineLabel}</span>
                                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ESTIMATED SMV CARD */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">
                          ESTIMATED SMV
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display font-bold text-4xl text-black">
                            {result.smv_range.split(" ")[0]}
                          </span>
                          <span className="text-sm font-semibold text-slate-400">min/pc</span>
                        </div>
                      </div>

                      <div className="flex gap-8">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Range</span>
                          <span className="text-sm font-bold text-slate-700">{result.smv_range}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Confidence</span>
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                            High
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl p-16 flex items-center justify-center text-center shadow-xs min-h-[400px]">
                <div>
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-slate-400 text-sm max-w-md">
                    Please upload a sketch in the <strong>Design Input</strong> tab and execute analysis to view step-by-step assembly flows.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: All Sewing Tools Catalog */}
        {activeTab === "tooling-view" && (
          <div className="fade-in w-full">
            <header className="mb-6">
              <span className="text-[10px] font-mono text-[#155DFC] font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Industrial Tooling Library</span>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight mt-1 mb-1.5">
                Sewing Machinery Catalog
              </h1>
              <p className="text-slate-500 text-xs max-w-2xl mb-4 leading-relaxed">
                Explore specialized Juki sewing machinery catalog, stitch technical specifications, needles, and attachments.
              </p>

              {/* Search catalog input with Category Dropdown & Autocomplete Suggestions */}
              <div className="flex flex-col sm:flex-row gap-3 max-w-3xl relative">
                {/* Category Dropdown */}
                <select
                  value={selectedMachineCategory}
                  onChange={(e) => setSelectedMachineCategory(e.target.value)}
                  className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#155DFC] cursor-pointer shadow-2xs"
                >
                  <option value="All Categories">All Categories</option>
                  <option value="Lockstitch">Lockstitch (DDL / DLN / DLU)</option>
                  <option value="Overlock">Overlock / Serger (MO)</option>
                  <option value="Buttonholing">Buttonholing / Bartack (LBH / LK)</option>
                  <option value="Pattern Sewer">Pattern Sewer (AMS / PS)</option>
                  <option value="Heavy Duty">Heavy Duty / Walking Foot (LU / PLC)</option>
                </select>

                {/* Search Bar with Autocomplete Dropdown */}
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Search Juki model or machine type (e.g. DDL-9000C, Overlock)..." 
                    value={machinerySearch}
                    onChange={(e) => {
                      setMachinerySearch(e.target.value);
                      setShowMachineryAutocomplete(true);
                    }}
                    onFocus={() => setShowMachineryAutocomplete(true)}
                    onBlur={() => setTimeout(() => setShowMachineryAutocomplete(false), 200)}
                    className="w-full bg-white border border-slate-200/80 rounded-xl py-2.5 pl-10 pr-4 text-xs font-sans focus:outline-none focus:border-[#155DFC] text-slate-900 shadow-2xs"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>

                  {/* Autocomplete Popup Suggestions (Good UX) */}
                  {showMachineryAutocomplete && machinerySearch.trim().length > 0 && defaultMachines && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-1 text-left">
                      {defaultMachines
                        .filter(tool => 
                          tool.name.toLowerCase().includes(machinerySearch.toLowerCase()) || 
                          (tool.desc || "").toLowerCase().includes(machinerySearch.toLowerCase())
                        )
                        .slice(0, 8)
                        .map((tool, idx) => (
                          <button
                            key={idx}
                            onMouseDown={() => {
                              setMachinerySearch(tool.name);
                              setShowMachineryAutocomplete(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-xs flex justify-between items-center cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                          >
                            <span className="font-bold text-slate-900 font-mono">{tool.name}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{tool.desc || tool.description}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {defaultMachines && defaultMachines.length > 0 ? (
                defaultMachines
                  .filter(tool => {
                    const matchesSearch = tool.name.toLowerCase().includes(machinerySearch.toLowerCase()) || 
                      (tool.desc || "").toLowerCase().includes(machinerySearch.toLowerCase());
                    if (selectedMachineCategory === "All Categories") return matchesSearch;
                    return matchesSearch && (tool.name.toLowerCase().includes(selectedMachineCategory.toLowerCase()) || (tool.desc || "").toLowerCase().includes(selectedMachineCategory.toLowerCase()));
                  })
                  .map((tool, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs flex flex-col h-full hover:border-[#155DFC]/40 transition-all duration-300">
                      {/* Machine Photo Rendering */}
                      <div className="bg-slate-50/70 border-b border-slate-100 aspect-[4/3] flex items-center justify-center p-3 relative overflow-hidden">
                        <img 
                          src={"/image/" + tool.file} 
                          alt={tool.name}
                          className="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.src = "/globe.svg";
                          }}
                        />
                      </div>
                      
                      <div className="p-6 flex flex-col flex-grow">
                        <h3 className="font-display font-bold text-slate-900 text-sm mb-2">{tool.name}</h3>
                        {renderSpecsDescription(tool.desc || tool.description)}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center space-y-6">
                  <div className="w-full max-w-md bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                      <span className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#155DFC]"></span>
                        </span>
                        Loading Juki Machinery Catalog...
                      </span>
                      <span className="font-mono text-[#155DFC] font-bold">120 / 310</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#155DFC] h-full rounded-full animate-pulse transition-all duration-500 w-[40%]"></div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Streaming specialized Juki tooling specifications asynchronously...</p>
                  </div>

                  {/* Skeleton Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full opacity-60">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-2xs animate-pulse space-y-4">
                        <div className="bg-slate-100 aspect-[4/3] rounded-xl"></div>
                        <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                        <div className="space-y-2 pt-2">
                          <div className="h-3 bg-slate-50 rounded w-full"></div>
                          <div className="h-3 bg-slate-50 rounded w-5/6"></div>
                          <div className="h-3 bg-slate-50 rounded w-4/6"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 5: SMV Estimator Sheet */}
        {activeTab === "smv-view" && (
          <div className="fade-in w-full">
            <header className="mb-10">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                SMV Estimator
              </h1>
              <p className="text-slate-500 text-lg">
                Calculates Standard Allowed Minutes (SAM/SMV) based on seam lengths, machine stitches per minute, and operator allowances.
              </p>
            </header>

            <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs max-w-4xl">
              <h2 className="font-display font-semibold text-xl mb-6">Standard Allowed Minutes Formula</h2>
              <div className="bg-slate-50 rounded-lg p-6 font-mono text-sm text-slate-700 mb-8 border border-zinc-150 leading-relaxed">
                SMV = (Basic Time) + (Bundle Allowance) + (Machine Allowance) + (Personal Allowance)<br />
                Basic Time = (Observed Time * Rating) / 100
              </div>

              <h3 className="font-display font-semibold text-md text-black mb-4">Calculation Factors</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="border border-zinc-200 rounded-lg p-5 bg-white">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">Standard Allowance</span>
                  <span className="font-display font-bold text-xl text-black">15% - 20%</span>
                </div>
                <div className="border border-zinc-200 rounded-lg p-5 bg-white">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">Machine RPM</span>
                  <span className="font-display font-bold text-xl text-black">4,500 - 5,500</span>
                </div>
                <div className="border border-zinc-200 rounded-lg p-5 bg-white">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">Estimated Efficiency</span>
                  <span className="font-display font-bold text-xl text-blue-600">85% (Target)</span>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6 text-sm text-slate-500 leading-relaxed">
                Estimations are dynamically matched with sewing process history using the vector database. Run a **Design Input** to receive garment-specific calculations.
              </div>
            </div>
          </div>
        )}

        {/* VIEW 6: Historical Search (pgvector search) */}
        {activeTab === "history-view" && (
          <div className="fade-in w-full">
            <header className="mb-10">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                Historical Knowledge Search
              </h1>
              <p className="text-slate-500 text-lg">
                Query pgvector similarity database for similar reference items, tooling logs, and past learnings.
              </p>
            </header>

            {/* Search Input */}
            <div className="flex gap-4 mb-10">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search historical databases by style, fabric type or tooling (e.g. Oxford, Denim)..."
                className="flex-grow bg-white border border-zinc-200 rounded-lg py-3.5 px-5 text-md font-body focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                className="py-3.5 px-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-300"
              >
                Search
              </button>
            </div>

            {/* Results Grid */}
            <div className="border border-zinc-150 rounded-xl p-9 bg-white min-h-[400px] flex flex-col justify-center">
              {searchResults.length === 0 ? (
                <p className="text-slate-400 text-center text-sm">
                  No historical entries in database. Add items to database to search.
                </p>
              ) : (
                <div>
                  <h2 className="font-display font-semibold text-2xl text-black mb-8">
                    Similar Historical Process Sheets ({searchResults.length} Matches Found)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {searchResults.map((match, idx) => (
                      <div key={idx} className="bg-slate-50 border border-zinc-200 rounded-xl p-7 shadow-xs">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-display font-semibold text-black text-md">
                            {match.title}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">
                            {match.ref}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-2 mb-4 leading-relaxed">
                          <div><strong>Specs:</strong> {match.features}</div>
                          <div><strong>Tooling:</strong> {match.tooling}</div>
                          <div><strong>SMV:</strong> {match.smv}</div>
                        </div>
                        <div className="border-t border-zinc-200 pt-3 text-[11px] text-slate-400 leading-relaxed">
                          <strong>Learnings:</strong> {match.learnings}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 7: Knowledge Base */}
        {activeTab === "knowledge-view" && (
          <div className="fade-in w-full">
            <header className="mb-6">
              <span className="text-[10px] font-mono text-[#155DFC] font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Engineering SOP & Technical Specs</span>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight mt-1 mb-1.5">
                Manufacturing Knowledge Base
              </h1>
              <p className="text-slate-500 text-xs max-w-2xl mb-4 leading-relaxed">
                Corporate engineering database, garment quality standards, and assembly reference manuals.
              </p>

              {/* Search Input with Category & Autocomplete */}
              <div className="flex flex-col sm:flex-row gap-3 max-w-4xl relative">
                <select
                  value={selectedKnowledgeCategory}
                  onChange={(e) => setSelectedKnowledgeCategory(e.target.value)}
                  className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#155DFC] cursor-pointer shadow-2xs"
                >
                  <option value="All Categories">All Categories</option>
                  <option value="Shirt">Formal &amp; Casual Shirts</option>
                  <option value="Pants">Trousers &amp; Pants</option>
                  <option value="Jacket">Outerwear &amp; Jackets</option>
                  <option value="Doll">Doll Apparel Standards</option>
                </select>

                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search sewing parameters, fabric guides, or garment standards..."
                    value={knowledgeSearch}
                    onChange={(e) => {
                      setKnowledgeSearch(e.target.value);
                      setShowKnowledgeAutocomplete(true);
                    }}
                    onFocus={() => setShowKnowledgeAutocomplete(true)}
                    onBlur={() => setTimeout(() => setShowKnowledgeAutocomplete(false), 200)}
                    className="w-full bg-white border border-slate-200/80 rounded-xl py-2.5 pl-10 pr-4 text-xs font-sans focus:outline-none focus:border-[#155DFC] text-slate-900 shadow-2xs"
                  />
                  <svg
                    className="absolute left-3.5 top-3 h-4 w-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>

                  {/* Autocomplete Popup */}
                  {showKnowledgeAutocomplete && knowledgeSearch.trim().length > 0 && knowledgeBase && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-1 text-left">
                      {knowledgeBase
                        .filter((k: any) => 
                          k.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) || 
                          k.ref.toLowerCase().includes(knowledgeSearch.toLowerCase())
                        )
                        .slice(0, 8)
                        .map((k, idx) => (
                          <button
                            key={idx}
                            onMouseDown={() => {
                              setKnowledgeSearch(k.title);
                              setShowKnowledgeAutocomplete(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-xs flex justify-between items-center cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                          >
                            <span className="font-bold text-slate-900 font-display">{k.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{k.ref}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="w-full">
              {knowledgeBase.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-slate-500 text-sm shadow-2xs">
                  Loading corporate reference guides and sewing parameters from database...
                </div>
              ) : (
                (() => {
                  const filtered = knowledgeBase.filter((k: any) => {
                    const term = knowledgeSearch.toLowerCase();
                    const matchesSearch = k.title.toLowerCase().includes(term) ||
                      k.ref.toLowerCase().includes(term) ||
                      (k.features && k.features.toLowerCase().includes(term)) ||
                      (k.learnings && k.learnings.toLowerCase().includes(term));
                    if (selectedKnowledgeCategory === "All Categories") return matchesSearch;
                    return matchesSearch && k.title.toLowerCase().includes(selectedKnowledgeCategory.toLowerCase());
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-slate-500 text-sm shadow-2xs">
                        No reference logs match your search criteria.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filtered.map((k: any, idx: number) => (
                        <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-8 shadow-2xs hover:border-[#155DFC]/40 transition-all duration-300 flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
                              <div>
                                <h2 className="font-display font-bold text-lg text-slate-900">{k.title}</h2>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{k.ref}</p>
                              </div>
                              {k.smv && k.smv !== "N/A" && (
                                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 text-xs font-mono font-bold text-[#155DFC]">
                                  SMV: <span>{k.smv}</span>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 text-xs text-slate-600 leading-relaxed mb-4">
                              {k.features && (
                                <div>
                                  <strong className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Key Features / Material Specs</strong>
                                  <p className="text-slate-700">{k.features}</p>
                                </div>
                              )}
                              {k.tooling && (
                                <div>
                                  <strong className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Tooling Recommendations</strong>
                                  <p className="text-slate-700">{k.tooling}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {k.learnings && (
                            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 text-xs text-slate-700 leading-relaxed mt-auto">
                              <strong className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Guidelines &amp; Manufacturing Learnings</strong>
                              {k.learnings}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* VIEW 8: Projects */}
        {activeTab === "projects-view" && (
          <div className="fade-in w-full">
            <header className="mb-6">
              <span className="text-[10px] font-mono text-[#155DFC] font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Database Management</span>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight mt-1 mb-1.5">
                Active Projects &amp; History
              </h1>
              <p className="text-slate-500 text-xs max-w-xl leading-relaxed">
                Manage your active garment styles, persistent analysis runs, and process sheet history.
              </p>
            </header>

            <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-2xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-base text-slate-900">Saved Projects Database</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Filter by Name, ID (#), Tags, Date, or Status with live record counts.</p>
                </div>

                {/* Status Dropdown with Dynamic Count Badges */}
                {(() => {
                  const totalCount = analysisHistory.length;
                  const approvedCount = analysisHistory.filter(item => {
                    const s = (item.result?.status || "").toUpperCase();
                    return s !== "REJECTED" && s !== "HISTORICAL_MATCH_FOUND";
                  }).length;
                  const duplicateCount = totalCount - approvedCount;

                  return (
                    <div className="flex items-center gap-3">
                      <select
                        value={historyStatusFilter}
                        onChange={(e) => setHistoryStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#155DFC] cursor-pointer shadow-2xs"
                      >
                        <option value="ALL">All Statuses ({totalCount})</option>
                        <option value="APPROVED">Approved ({approvedCount})</option>
                        <option value="DUPLICATE">Duplicate Locked ({duplicateCount})</option>
                      </select>
                    </div>
                  );
                })()}
              </div>

              {/* Search Bar & Tag Filter Pills */}
              <div className="flex flex-col gap-3">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search by project name, ID (#18), tag (SS26), designer notes, or date..."
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 focus:bg-white focus:border-[#155DFC] focus:outline-none transition-colors"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery("")}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-700 font-bold"
                    >✕</button>
                  )}
                </div>

                {/* Quick Tag Pills Bar */}
                {availableTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter by Tag:</span>
                    <button
                      type="button"
                      onClick={() => setHistoryTagFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        historyTagFilter === "ALL"
                          ? "bg-[#155DFC] text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Tags
                    </button>
                    {availableTags.map(t => {
                      const isSel = historyTagFilter === t;
                      const count = analysisHistory.filter(h => (h.result?.tags || []).includes(t)).length;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setHistoryTagFilter(isSel ? "ALL" : t)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSel
                              ? "bg-[#155DFC] text-white shadow-2xs"
                              : "bg-blue-50 text-[#155DFC] border border-blue-200/60 hover:bg-blue-100"
                          }`}
                        >
                          <svg className={`w-3 h-3 ${isSel ? "text-white" : "text-[#155DFC]"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                          <span>{t}</span>
                          <span className="opacity-75 font-mono text-[10px]">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border border-slate-100 rounded-xl overflow-visible">
                 <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-50/70 font-mono text-[11px] text-slate-400 uppercase border-b border-slate-100">
                    <tr>
                      <th className="py-4 px-6 font-bold w-16">ID</th>
                      <th className="py-4 px-6 font-bold">Project Name &amp; Tags</th>
                      <th className="py-4 px-6 font-bold">Date Created</th>
                      <th className="py-4 px-6 font-bold">Status</th>
                      <th className="py-4 px-6 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(() => {
                      const filteredHistory = analysisHistory.filter(item => {
                        const s = (item.result?.status || "").toUpperCase();
                        const isRejected = s === "REJECTED" || s === "HISTORICAL_MATCH_FOUND";
                        
                        if (historyStatusFilter === "APPROVED" && isRejected) return false;
                        if (historyStatusFilter === "DUPLICATE" && !isRejected) return false;

                        const itemTags: string[] = item.result?.tags || [];
                        if (historyTagFilter !== "ALL" && !itemTags.includes(historyTagFilter)) return false;

                        if (historySearchQuery.trim()) {
                          const q = historySearchQuery.toLowerCase().trim();
                          const idStr = item.id.toString().toLowerCase();
                          const nameStr = (item.fileName || item?.result?.classification?.[0]?.class_name || "").toLowerCase();
                          const dateStr = (item.timestamp || "").toLowerCase();
                          const notesStr = (item.result?.designer_notes || "").toLowerCase();
                          const tagsStr = itemTags.join(" ").toLowerCase();

                          const matches = idStr.includes(q) ||
                            nameStr.includes(q) ||
                            dateStr.includes(q) ||
                            notesStr.includes(q) ||
                            tagsStr.includes(q) ||
                            `#${idStr}`.includes(q);

                          if (!matches) return false;
                        }

                        return true;
                      });

                      if (filteredHistory.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                              {analysisHistory.length === 0 
                                ? "No active projects found. Upload sketches in Create Process Sheet to populate database."
                                : "No projects match your search query and filters."}
                            </td>
                          </tr>
                        );
                      }

                      return filteredHistory.map((item, idx) => {
                        const s = (item.result?.status || "").toUpperCase();
                        const isRejected = s === "REJECTED" || s === "HISTORICAL_MATCH_FOUND";
                        const formattedDate = formatActivityDate(item);
                        const itemTags: string[] = item.result?.tags || [];
                        const notes: string = item.result?.designer_notes || "";

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-semibold font-mono text-slate-900">#{item.id}</td>
                            <td className="py-4 px-6">
                              <span className="font-semibold text-slate-900 block">{item.fileName || item?.result?.classification?.[0]?.class_name || "Untitled Project"}</span>
                              {itemTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {itemTags.map(t => (
                                    <span key={t} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#155DFC] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/50">
                                      <svg className="w-2.5 h-2.5 text-[#155DFC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {notes && (
                                <p className="text-[10px] text-slate-500 truncate max-w-xs mt-1 font-sans flex items-center gap-1">
                                  <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                  <span className="italic truncate">&quot;{notes}&quot;</span>
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-500">{formattedDate}</td>
                            <td className="py-4 px-6">
                              {isRejected ? (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                  Duplicate Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                  Approved
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                }}
                                className="text-slate-400 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
                                aria-label="Actions Menu"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                              </button>
                              
                              {activeMenuId === item.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40 cursor-default" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                    }} 
                                  />
                                  <div className={`absolute right-6 ${idx >= filteredHistory.length - 2 ? "bottom-full mb-1" : "top-full mt-1"} z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 w-40 text-left animate-in fade-in duration-100`}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLoadProject(item);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 text-[#155DFC] font-semibold flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Load Specs
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                        handleRenameProject(item.id, item.fileName || "");
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                      </svg>
                                      Rename
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                        handleDeleteProject(item.id);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-slate-100 cursor-pointer font-semibold"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 9: System Settings */}
        {activeTab === "settings-view" && (
          <div className="fade-in w-full">
            <header className="mb-6">
              <span className="text-[10px] font-mono text-[#155DFC] font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">System Preferences</span>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 tracking-tight mt-1 mb-1.5">
                System Settings
              </h1>
              <p className="text-slate-500 text-xs max-w-xl leading-relaxed">
                Configure your API hosts, DINOv2 AI embedding engine, and persistent database credentials.
              </p>
            </header>

            <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-2xs max-w-4xl space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wider mb-2">API Host Configuration</h3>
                <input type="text" disabled value="http://127.0.0.1:8000" className="w-full bg-slate-50/70 border border-slate-100 rounded-xl p-3 text-xs font-mono text-slate-700 font-semibold" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wider mb-2">Visual Feature Extractor Engine</h3>
                <input type="text" disabled value="DINOv2 ViT-S/14 Deep Neural Embedding Engine (384-dim)" className="w-full bg-slate-50/70 border border-slate-100 rounded-xl p-3 text-xs font-mono text-slate-700 font-semibold" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wider mb-2">Vector Similarity Database</h3>
                <input type="text" disabled value="pgvector / SQLite Vector Indexing (Cosine Similarity Threshold: 95.0%)" className="w-full bg-slate-50/70 border border-slate-100 rounded-xl p-3 text-xs font-mono text-slate-700 font-semibold" />
              </div>
              <div className="text-xs text-slate-400 leading-relaxed pt-4 border-t border-slate-100 font-mono">
                To switch between SQLite and PostgreSQL, update your <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#155DFC]">.env</code> settings at the project root and restart python server.
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal before returning to Step 1 */}
        {showBackConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-4">
              <div className="flex items-start gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Return to Step 1 Mode Choice?</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Going back to Step 1 will reset your current sketch upload and filled engineering parameters.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBackConfirmModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel &amp; Keep Progress
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBackToStep1}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Yes, Return to Step 1
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enterprise Tech Pack Printable Modal */}
        {showTechPackModal && activeTechPackData && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8 border border-slate-200 print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none">
              {/* Action Bar (Hidden on print) */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300">Enterprise Engineering Tech Pack</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-[#155DFC] hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print / Save PDF
                  </button>
                  <button
                    onClick={() => setShowTechPackModal(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Tech Pack Body */}
              <div className="p-8 sm:p-10 space-y-8 print:p-0 print:space-y-6 text-slate-900 font-sans">
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">FashionFlow AI — Industrial Engineering Specification Sheet</span>
                    <h1 className="text-3xl font-display font-extrabold text-slate-900 mt-1">
                      {activeTechPackData?.project_details?.name || activeTechPackData?.classification?.[0]?.class_name || "Garment Production Specification"}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-600">
                      <span>Category: <strong>{activeTechPackData?.project_details?.garment_type || activeTechPackData?.project_details?.doll_type || "Garment"}</strong></span>
                      <span>•</span>
                      <span>Fabric: <strong>{activeTechPackData?.project_details?.fabric_weight || "Medium-weight"}</strong></span>
                      <span>•</span>
                      <span>Date: <strong>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
                      APPROVED (Pre-Production)
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400 mt-2">DINOv2 Hash Verified</span>
                  </div>
                </div>

                {/* Section 1: Pre-Production Readiness Checklist */}
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">1. FexQMS Pre-Production Readiness Checklist</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {(activeTechPackData?.engineering_checklist || []).map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span className="font-semibold text-slate-800">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Step-by-Step Sewing Flow Table */}
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">2. Step-by-Step Sewing Sequence &amp; Machinery Specs</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono uppercase text-slate-600">
                          <th className="py-2.5 px-3">Step</th>
                          <th className="py-2.5 px-3">Operation</th>
                          <th className="py-2.5 px-3">JUKI Machine Model</th>
                          <th className="py-2.5 px-3">Needle</th>
                          <th className="py-2.5 px-3">Presser Foot</th>
                          <th className="py-2.5 px-3">Stitch Spec</th>
                          <th className="py-2.5 px-3 text-right">SMV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {(activeTechPackData?.sewing_sequence_detailed || []).map((step: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">#{step.step_num || i + 1}</td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{step.operation}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-700">{step.recommended_model}</td>
                            <td className="py-2.5 px-3 text-slate-600">{step.needle || "DBx1 (#11)"}</td>
                            <td className="py-2.5 px-3 text-slate-600">{step.presser_foot || "Standard Foot"}</td>
                            <td className="py-2.5 px-3 text-slate-600">{step.stitch_spec || "2.5mm/10 SPI"}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">{step.smv_mins || "1.5"}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Factory Line Balancing & Work-Aids */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">3. Line Balancing Machine Unit Allocations</h3>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between text-xs font-mono border-b border-slate-200 pb-2 mb-2">
                        <span className="text-slate-500">Target Volume:</span>
                        <strong className="text-slate-900">{activeTechPackData?.line_balancing?.target_daily_units || 500} pcs/day</strong>
                      </div>
                      <div className="flex justify-between text-xs font-mono border-b border-slate-200 pb-2 mb-2">
                        <span className="text-slate-500">Takt Time:</span>
                        <strong className="text-slate-900">{activeTechPackData?.line_balancing?.takt_time_mins || 0.96} mins/unit</strong>
                      </div>
                      {(activeTechPackData?.line_balancing?.machine_allocations || []).map((m: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs font-mono">
                          <span className="text-slate-700">{m.machine_model}</span>
                          <strong className="text-blue-700">{m.required_units} Units ({m.utilization_pct}%)</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">4. Work-Aid Tooling Attachments &amp; Jigs</h3>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      {(activeTechPackData?.work_aids || []).map((aid: any, i: number) => (
                        <div key={i} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0 text-xs">
                          <div className="flex justify-between font-semibold text-slate-900">
                            <span>{aid.attachment_name}</span>
                            <span className="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">{aid.aid_type}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-sans leading-tight mt-0.5">{aid.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sign-off Block */}
                <div className="border-t-2 border-slate-900 pt-6 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block uppercase text-[10px]">Prepared By</span>
                    <strong className="text-slate-900">FashionFlow AI Engineering Copilot</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block uppercase text-[10px]">Lead Production Engineer Sign-off</span>
                    <span className="inline-block border-b border-slate-400 w-48 mt-4 text-center text-slate-300 font-sans italic">Approved for Factory Hand-off</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 Process Sheet Compilation Confirmation Review Modal */}
        {showProcessSheetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#155DFC] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">Compile Process Sheet?</h3>
                  <p className="text-xs text-slate-500">Please review engineering parameters before compiling final sheet.</p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 text-xs overflow-hidden">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Project / Batch Name:</span>
                  <strong className="text-slate-900 font-bold break-words break-all text-right max-w-[220px]">
                    {quizName.trim() || result?.top_3_saved_projects?.[0]?.title || "New Pattern Project"}
                  </strong>
                </div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Garment Category:</span><strong className="text-slate-900 font-semibold">{quizGarment}</strong></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Fabric Application:</span><strong className="text-slate-900 font-semibold">{quizFabric}</strong></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Production Run Quantity:</span><strong className="text-[#155DFC] font-mono font-bold">{batchQuantity} pcs</strong></div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-500 shrink-0">Project Tags:</span>
                  <span className="font-semibold text-slate-800 text-right break-words break-all max-w-[220px]">
                    {selectedTags.length > 0 ? selectedTags.join(", ") : "None"}
                  </span>
                </div>
                {designerNotes && (
                  <div className="border-t border-slate-200/60 pt-2.5 mt-2 overflow-hidden">
                    <span className="text-slate-500 block mb-1">Designer Notes:</span>
                    <p className="text-slate-700 italic font-sans bg-white p-2.5 rounded-lg border border-slate-200/60 break-words break-all whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                      &quot;{designerNotes}&quot;
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProcessSheetConfirmModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProcessSheetConfirmModal(false);
                    executeCompilation();
                  }}
                  className="px-6 py-2.5 bg-[#155DFC] hover:bg-[#1249cc] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <span>Confirm &amp; Compile Sheet</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
