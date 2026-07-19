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
  warning?: string;
  manufacturability_score?: number;
  similarity_percentage: number;
  status: string;
  message: string;
  visual_vector?: number[];
}

interface SavedAnalysis {
  id: string;
  timestamp: string;
  fileName: string;
  result: AnalysisResult;
}

const renderSpecsDescription = (desc: string) => {
  if (!desc) return null;
  // Split specs cleanly by line break or bullet dot symbol
  const rawItems = desc.split(/[\n•]/).map(item => item.trim()).filter(Boolean);
  
  return (
    <div className="mt-4 border-t border-zinc-150 pt-4 w-full">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Technical Specifications</h4>
      <div className="bg-slate-50/70 rounded-lg p-3 border border-zinc-200/60 space-y-2">
        {rawItems.map((item, i) => {
          const cleanItem = item.replace(/\*\*/g, "").trim();
          if (!cleanItem) return null;
          
          const parts = cleanItem.split(":");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(":").trim();
            return (
              <div key={i} className="flex justify-between items-center text-[11px] border-b border-zinc-200/40 pb-1.5 last:border-0 last:pb-0 gap-2">
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
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [fullResult, setFullResult] = useState<any | null>(null);

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
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");

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
    }
    fetchInitialData();
  }, []);

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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Handle Project Deletion from DB
  const handleDeleteProject = async (id: string) => {
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
  const handleRenameProject = async (id: string, currentName: string) => {
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
        message: `Consolidated doll clothing process sheet for ${dollType}.`
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
    if (!quizName.trim()) {
      alert("Please enter a project name.");
      return;
    }
    if (!result) return;

    setIsLoading(true);
    try {
      const payload = {
        project_name: quizName.trim(),
        garment_type: quizGarment,
        fabric_weight: quizFabric,
        preview_image: result.preview_image,
        similarity_percentage: result.similarity_percentage,
        similarity_status: result.status,
        classification_name: result?.classification?.[0]?.class_name || "Original Pattern",
        message: result.message,
        // CRITICAL: send visual_vector so backend can persist it for future cosine-similarity duplicate detection
        visual_vector: result.visual_vector || []
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
        alert("Failed to generate process sheet.");
      }
    } catch (err) {
      console.error("Error generating process sheet:", err);
      alert("Database connection failed.");
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
    setComponentsState({
      jacket: { fabricWeight: "Denim (Heavy-weight)", imageFile: null, previewUrl: null, result: null },
      pants: { fabricWeight: "Katun (Medium-weight)", imageFile: null, previewUrl: null, result: null },
      hat: { fabricWeight: "Sutra (Light-weight)", imageFile: null, previewUrl: null, result: null }
    });
    setDollType("Classic Teddy Bear");
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

  const processFile = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null); // Clear previous results for new uploads
  };

  const handleReset = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setResult(null);
  };

  // Load a historical analysis into active view
  // Load a historical analysis into active view
  const loadSavedAnalysis = (saved: SavedAnalysis) => {
    handleLoadProject(saved);
  };

  // Run Inference / Prediction
  const handleAnalyze = async () => {
    if (!imageFile) return;

    setIsLoading(true);
    
    // Create Form Data to send to API
    const formData = new FormData();
    formData.append("image", imageFile);
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
        
        // Refresh persistent history list from the database
        try {
          const historyRes = await fetch("http://127.0.0.1:8000/api/history");
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setAnalysisHistory(historyData.history);
          }
        } catch (historyErr) {
          console.warn("Failed to refresh history after analysis:", historyErr);
        }

        // Stay on Create Process Sheet view to answer quiz options (no redirects)
      } else {
        throw new Error("Failed to run prediction");
      }
    } catch (err) {
      console.error("FastAPI server prediction failed.", err);
      alert("Inference failed: FastAPI backend server is offline or model loading failed. Please ensure your backend is running with 'python main.py' and your model weights exist in 'models/'.");
    } finally {
      setIsLoading(false);
    }
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

  const sidebarItems = [    { id: "dashboard-view", label: "Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
    { id: "design-input-view", label: "Create Process Sheet", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { id: "tooling-view", label: "Machine Catalog", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.594 15.12a2 2 0 00-1.022.547l-1.4 1.4A2 2 0 004.596 20.5l.896-.896a2 2 0 011.414-.586h.88a2 2 0 001.414-.586l1.242-1.243a4 4 0 012.829-1.172h.434a4 4 0 012.829 1.172l1.242 1.243a2 2 0 001.414.586h.88a2 2 0 011.414.586l.896.896a2 2 0 001.414-2.828l-1.4-1.4z" },
    { id: "knowledge-view", label: "Garment Type Catalog", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { id: "projects-view", label: "Projects Database", icon: "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 012 2v3a2 2 0 01-2 2H5z" },
    { id: "settings-view", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800">
      {/* Sidebar Navigation */}
      <aside
        className={`h-full border-r border-zinc-200 bg-slate-50 flex flex-col py-8 px-5 flex-shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-[78px] px-3.5" : "w-[280px]"
        }`}
      >
        <div className="flex items-center gap-4 mb-10 pl-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-800 hover:text-black focus:outline-none"
            aria-label="Toggle Sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          {!isCollapsed && (
            <span className="font-display font-bold text-xl text-black select-none flex items-center gap-1.5">
              FashionFlow <span className="bg-blue-600 text-white text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md font-bold">AI</span>
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2 flex-grow overflow-y-auto pr-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center rounded-lg font-medium text-[14px] py-3 px-4 transition-all duration-300 w-full ${
                activeTab === item.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              } ${isCollapsed ? "justify-center px-0 gap-0" : "gap-4"}`}
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
              {!isCollapsed && <span className="whitespace-nowrap truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Panel Content (Scrolls independently - Fluid Full Screen Layout) */}
      <main className="flex-grow h-full overflow-y-auto p-12">
        
        {/* VIEW 1: Dashboard */}
        {activeTab === "dashboard-view" && (
          <div className="fade-in w-full">
            <header className="mb-10">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                Production Overview
              </h1>
              <p className="text-slate-500 text-lg">
                Identify fabric patterns, generate sewing step plannings, and estimate tooling requirements.
              </p>
            </header>

            {/* System Workflow Steps Guide */}
            <div className="bg-white border border-zinc-200 rounded-xl p-9 shadow-xs mb-8">
              <h2 className="font-display font-semibold text-2xl mb-6">How FashionFlow AI Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-lg hover:border-blue-500/20 hover:shadow-xs transition-all duration-300">
                  <span className="text-xs font-mono text-blue-600 font-bold uppercase tracking-wider">Step 1</span>
                  <h3 className="font-semibold text-black text-base">Upload Design</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">Upload a garment pattern sketch or fabric layout image to the system.</p>
                </div>
                <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-lg hover:border-blue-500/20 hover:shadow-xs transition-all duration-300">
                  <span className="text-xs font-mono text-blue-600 font-bold uppercase tracking-wider">Step 2</span>
                  <h3 className="font-semibold text-black text-base">Originality Check</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">The ensemble AI model verifies pattern originalities against database records using a 95% similarity threshold.</p>
                </div>
                <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-lg hover:border-blue-500/20 hover:shadow-xs transition-all duration-300">
                  <span className="text-xs font-mono text-blue-600 font-bold uppercase tracking-wider">Step 3</span>
                  <h3 className="font-semibold text-black text-base">Production Quiz</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">If approved, assign a project name and specify fabric weights and options through validation inputs.</p>
                </div>
                <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-lg hover:border-blue-500/20 hover:shadow-xs transition-all duration-300">
                  <span className="text-xs font-mono text-blue-600 font-bold uppercase tracking-wider">Step 4</span>
                  <h3 className="font-semibold text-black text-base">Generate Specs</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">The system automatically recommends matching industrial sewing machinery and generates step-by-step sewing sequences.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-zinc-200 rounded-xl p-9 shadow-xs flex flex-col justify-center">
                <h2 className="font-display font-semibold text-2xl mb-4">Originality Verification</h2>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Before sending garments to production lines, FashionFlow evaluates textiles against copyright and pattern records. If duplicate matches are found, details are displayed instantly to reduce copyright infringement conflicts.
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Navigate to the <strong>Design Input</strong> tab in the sidebar to upload a sketch and run analysis.
                </p>
              </div>

              {/* Decorative Graphic Block */}
              <div className="bg-white border border-zinc-200 rounded-xl p-9 flex items-center justify-center shadow-xs">
                <div className="grid grid-cols-2 gap-4 w-full aspect-square max-h-[300px]">
                  <div className="rounded-lg border border-zinc-200 opacity-80 hover:opacity-100 hover:scale-102 transition-all duration-300 bg-[radial-gradient(circle,rgba(59,130,246,0.5)_10%,transparent_11%)] bg-[length:15px_15px]"></div>
                  <div className="rounded-lg border border-zinc-200 opacity-80 hover:opacity-100 hover:scale-102 transition-all duration-300 bg-[linear-gradient(45deg,rgba(0,0,0,0.02)_25%,transparent_25%),linear-gradient(-45deg,rgba(0,0,0,0.02)_25%,transparent_25%)] bg-[length:20px_20px]"></div>
                  <div className="rounded-lg border border-zinc-200 opacity-80 hover:opacity-100 hover:scale-102 transition-all duration-300 bg-[radial-gradient(circle_at_0_0,transparent_50%,rgba(59,130,246,0.4)_50%,rgba(59,130,246,0.4)_55%,transparent_55%)] bg-[length:20px_20px]"></div>
                  <div className="rounded-lg border border-zinc-200 opacity-80 hover:opacity-100 hover:scale-102 transition-all duration-300 bg-[linear-gradient(0deg,rgba(0,0,0,0.02)_50%,transparent_50%)] bg-[length:10px_10px]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Create Process Sheet (Garment Sketch Upload, Parameters Quiz, Unified specs) */}
        {activeTab === "design-input-view" && (
          <div className="fade-in w-full">
            {!isQuizSubmitted ? (              // Quiz Form & Input Step
              <div className="w-full">
                <header className="mb-8">
                  <h1 className="font-display font-bold text-4xl text-black mb-2">
                    Create Process Sheet
                  </h1>
                  <p className="text-slate-500 text-lg">
                    Define your project parameters, upload garment sketches, and compile unified sewing specifications.
                  </p>
                </header>

                {/* Project Mode Toggle Switch */}
                <div className="flex items-center gap-2 mb-8 bg-slate-100 p-1 rounded-lg w-fit border border-zinc-200">
                  <button
                    onClick={() => setProjectMode("doll")}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition-all duration-300 ${
                      projectMode === "doll"
                        ? "bg-white text-blue-600 shadow-xs border border-zinc-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🧸 Doll Outfit Project (Multi-Fabric)
                  </button>
                  <button
                    onClick={() => setProjectMode("single")}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition-all duration-300 ${
                      projectMode === "single"
                        ? "bg-white text-blue-600 shadow-xs border border-zinc-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    👕 Single Garment Project
                  </button>
                </div>

                {projectMode === "doll" ? (
                  // --- Doll Outfit Project Setup Layout ---
                  <div className="flex flex-col gap-8 w-full animate-in fade-in duration-300">
                    {/* Project Parameters Card */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">Project Name</label>
                        <input
                          type="text"
                          value={quizName}
                          onChange={(e) => setQuizName(e.target.value)}
                          placeholder="e.g. Teddy Winter Adventure Outfit Set"
                          required
                          className="bg-slate-50 border border-zinc-200 rounded-md py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 w-full text-black font-medium"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">Doll Type Template</label>
                        <select
                          value={dollType}
                          onChange={(e) => setDollType(e.target.value)}
                          className="bg-slate-50 border border-zinc-200 rounded-md py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 w-full text-black font-semibold"
                        >
                          {Object.keys(DOLL_TYPES).map(t => (
                            <option key={t} value={t}>
                              {t} — ({DOLL_TYPES[t].map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(" + ")})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Garment Components Grid */}
                    <div>
                      <h3 className="font-display font-bold text-lg text-black mb-4">Garment Components Checklist</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {(DOLL_TYPES[dollType] || []).map((g) => {
                          const compState = componentsState[g] || { fabricWeight: "Cotton (Medium-weight)", imageFile: null, previewUrl: null, result: null };
                          return (
                            <div key={g} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col justify-between gap-4 border-l-4 border-l-blue-500">
                              <div>
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider font-mono bg-blue-50 px-2.5 py-1 rounded">
                                    {g}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">Required Component</span>
                                </div>

                                {/* Component Image Slot */}
                                {!compState.previewUrl ? (
                                  <label className="border-2 border-dashed border-zinc-200 hover:border-blue-500 rounded-lg flex flex-col items-center justify-center p-6 aspect-video text-center cursor-pointer bg-slate-50/50 transition-all duration-300">
                                    <input
                                      type="file"
                                      onChange={(e) => { if (e.target.files?.[0]) handleComponentFileChange(g, e.target.files[0]) }}
                                      accept="image/*"
                                      className="hidden"
                                    />
                                    <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-[11px] text-slate-500 font-medium">Upload {g} sketch</span>
                                  </label>
                                ) : (
                                  <div className="relative rounded-lg overflow-hidden border border-zinc-200 aspect-video bg-slate-50 flex items-center justify-center">
                                    <img src={compState.previewUrl} alt={`${g} preview`} className="max-w-full max-h-full object-contain" />
                                    <button
                                      type="button"
                                      onClick={() => setComponentsState(prev => ({
                                        ...prev,
                                        [g]: { ...prev[g], imageFile: null, previewUrl: null, result: null }
                                      }))}
                                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-650 transition-colors"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}

                                {/* Component Fabric Select */}
                                <div className="flex flex-col gap-1.5 mt-4">
                                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Fabric Application</label>
                                  <select
                                    value={compState.fabricWeight}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setComponentsState(prev => ({
                                        ...prev,
                                        [g]: { ...prev[g], fabricWeight: val }
                                      }));
                                    }}
                                    className="bg-slate-50 border border-zinc-200 rounded-md py-2 px-3 text-xs focus:outline-none focus:border-blue-500 w-full text-black font-semibold"
                                  >
                                    <optgroup label="Light-weight">
                                      <option value="Silk (Light-weight)">Sutra / Silk (Light)</option>
                                      <option value="Chiffon (Light-weight)">Sifon / Chiffon (Light)</option>
                                      <option value="Organza (Light-weight)">Organza (Light)</option>
                                    </optgroup>
                                    <optgroup label="Medium-weight">
                                      <option value="Cotton (Medium-weight)">Katun / Cotton (Med)</option>
                                      <option value="Batik (Medium-weight)">Batik Tulis/Cap (Med)</option>
                                      <option value="Linen (Medium-weight)">Linen (Med)</option>
                                    </optgroup>
                                    <optgroup label="Heavy-weight">
                                      <option value="Denim (Heavy-weight)">Denim / Jeans (Heavy)</option>
                                      <option value="Corduroy (Heavy-weight)">Corduroy (Heavy)</option>
                                      <option value="Tweed (Heavy-weight)">Tweed / Wool (Heavy)</option>
                                    </optgroup>
                                  </select>
                                </div>
                              </div>

                              {/* Component AI Verification Info */}
                              {compState.result ? (() => {
                                 const compRes = compState.result;
                                 const _s = (compRes.status || "").toUpperCase();
                                 const isRejected = _s === "REJECTED" || _s === "HISTORICAL_MATCH_FOUND";
                                 const dbScore = compRes.similarity_percentage || 0;
                                 return (
                                   <div className={`p-3 rounded-lg border text-[11px] font-medium leading-normal ${
                                     isRejected ? "bg-red-50 border-red-200 text-red-900" : "bg-green-50 border-green-200 text-green-900"
                                   }`}>
                                     <div className="flex justify-between items-center mb-1">
                                       <span className="font-bold uppercase tracking-wider text-[9px] opacity-75">AI Verdict</span>
                                       <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                         isRejected ? "bg-red-200 text-red-955" : "bg-green-200 text-green-955"
                                       }`}>{isRejected ? "REJECTED" : "APPROVED"}</span>
                                     </div>
                                     <div className="truncate">Motif: {compRes?.classification?.[0]?.class_name || "Original Pattern"}</div>
                                     <div>DB Similarity: {dbScore.toFixed(1)}%</div>
                                   </div>
                                 );
                               })() : compState.previewUrl ? (
                                <div className="bg-slate-50 border border-zinc-200 p-3 rounded-lg text-center text-[10px] text-slate-400 font-medium">
                                  Running pattern analysis...
                                </div>
                              ) : (
                                <div className="bg-slate-50 border border-dashed border-zinc-200 p-3 rounded-lg text-center text-[10px] text-slate-400">
                                  Upload sketch to verify pattern originality.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Compile Action Button */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleGenerateDollProcessSheet}
                        disabled={isLoading || !quizName.trim()}
                        className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-300 disabled:opacity-50 flex items-center gap-2 shadow-md text-sm cursor-pointer"
                      >
                        {isLoading ? "Generating Doll Specs..." : "Compile Doll Project Sheet 🧸"}
                      </button>
                    </div>
                  </div>
                ) : (
                  // --- Original Single Garment Project Setup Layout ---
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 animate-in fade-in duration-300">
                    {/* Left Column: Model Config & Sketch Upload */}
                    <div className="xl:col-span-3 flex flex-col gap-6">
                      {/* Ensemble Mode Config Badge & Interactive Switch */}
                      {!result && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-blue-900">Ensemble Analysis Mode</p>
                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  isEnsembleMode ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
                                }`}>
                                  {isEnsembleMode ? "ENSEMBLE (3 MODELS)" : "SINGLE MODEL"}
                                </span>
                              </div>
                              <p className="text-[11px] text-blue-700 mt-0.5">
                                {isEnsembleMode 
                                  ? "All 3 models run simultaneously — MobileNetV3 Large, ResNet50, EfficientNet-B0" 
                                  : "Single model mode — Select 1 model from dropdown for focused inference"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {!isEnsembleMode && (
                              <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="bg-white border border-blue-300 text-slate-800 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-600 shadow-xs text-black"
                              >
                                <option value="mobilenet_textiles.pth">MobileNetV3 Large (.pth)</option>
                                <option value="resnet50_textiles.pth">ResNet50 (.pth)</option>
                                <option value="efficientnet_textiles.pth">EfficientNet-B0 (.pth)</option>
                              </select>
                            )}

                            {/* Toggle Switch */}
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" title="Toggle Ensemble vs Single Model">
                              <input
                                type="checkbox"
                                checked={isEnsembleMode}
                                onChange={(e) => setIsEnsembleMode(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Image Upload Box */}
                      <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs">
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="font-display font-semibold text-xl">Garment Sketch</h2>
                          {previewUrl && (
                            <button
                              onClick={handleResetWorkspace}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline focus:outline-none"
                            >
                              Upload New Sketch
                            </button>
                          )}
                        </div>

                        {!previewUrl ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={triggerFileSelect}
                            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-12 aspect-video text-center cursor-pointer transition-all duration-300 bg-slate-50/50 ${
                              isDragOver ? "border-blue-600 bg-blue-600/5" : "border-zinc-200 hover:border-blue-500"
                            }`}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="image/*"
                              className="hidden"
                            />
                            <svg
                              className="w-12 h-12 text-slate-400 mb-4 transition-transform duration-300 hover:translate-y-[-2px]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              viewBox="0 0 24 24"
                            >
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <p className="text-[14px] text-slate-500">
                              Drag & drop garment sketch or <span className="text-blue-600 underline font-medium">browse files</span>
                            </p>
                          </div>
                        ) : (
                          <div className="relative rounded-xl overflow-hidden border border-zinc-200 aspect-[16/9] w-full bg-slate-50 flex items-center justify-center">
                            <img
                              src={result ? result.preview_image : previewUrl}
                              alt="Garment Preview"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        )}

                        {/* Multi-model breakdown or Verify button */}
                        {result ? (
                          <div className="mt-6 flex flex-col gap-3">
                            {/* Clean, Unified Originality Check Results */}
                            {result && (() => {
                              const _s = (result.status || "").toUpperCase();
                              const isRejected = _s === "REJECTED" || _s === "HISTORICAL_MATCH_FOUND";
                              const dbScore = result.similarity_percentage || 0;

                              return (
                                <div className="flex flex-col gap-3">
                                  {/* Single Unified Verdict Banner */}
                                  <div className={`p-5 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${
                                    isRejected ? "bg-red-50 border-red-200 text-red-900" : "bg-green-50 border-green-200 text-green-900"
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-mono uppercase tracking-widest font-bold opacity-75">Originality Check Verdict</span>
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        isRejected ? "bg-red-200 text-red-955" : "bg-green-200 text-green-955"
                                      }`}>{isRejected ? "REJECTED" : "APPROVED"}</span>
                                    </div>

                                    <div className="flex items-baseline gap-2 mt-1">
                                      <span className={`font-display font-bold text-3xl ${
                                        isRejected ? "text-red-700" : "text-green-700"
                                      }`}>{dbScore.toFixed(2)}%</span>
                                      <span className="text-xs font-semibold opacity-75">
                                        database similarity score
                                      </span>
                                    </div>

                                    <p className="text-xs leading-relaxed opacity-90 font-medium mt-1">
                                      {result.message || (isRejected 
                                        ? `Critical Warning: ${dbScore.toFixed(2)}% duplicate image match detected in database. Pattern already exists.` 
                                        : `Clear: ${dbScore.toFixed(2)}% database similarity detected. Safe for garment production.`)}
                                    </p>

                                    {result.model_results && result.model_results.length > 0 && (
                                      <div className="pt-2 flex justify-end">
                                        <button
                                          onClick={() => setShowModelDetails(!showModelDetails)}
                                          className="text-xs font-semibold underline flex items-center gap-1 opacity-80 hover:opacity-100"
                                        >
                                          {showModelDetails ? "Hide Experimental Pattern Models ▲" : `View Experimental Pattern Models (${result.model_results.length}) ▼`}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Collapsible Model Breakdown Details */}
                                  {showModelDetails && (
                                    <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in duration-200">
                                      <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                                          {result.model_results.length > 1 ? "Multi-Model Classifier Breakdown" : "Single Model Classifier Breakdown"}
                                        </span>
                                        <span className="text-[10px] text-blue-600 font-semibold">
                                          {result.model_results.length > 1 ? "Ensemble Verified" : "Single Model Verified"}
                                        </span>
                                      </div>
                                      {result.model_results.map((mr, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border bg-slate-50/70 border-zinc-150">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-800">{mr.model_name}</span>
                                            <span className="text-xs font-bold text-slate-700">
                                              {mr.status !== "ok" ? "Error" : `${mr.confidence_pct}%`}
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-slate-500 italic">{mr.class_name}</div>
                                          <div className="h-1.5 rounded-full bg-slate-200/60 overflow-hidden">
                                            <div
                                              className="h-full rounded-full bg-blue-500 transition-all duration-700"
                                              style={{ width: `${Math.min(mr.confidence_pct, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}

                        {previewUrl && !result && (
                          <button
                            onClick={handleAnalyze}
                            disabled={isLoading}
                            className="mt-6 w-full py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-300 disabled:opacity-50"
                          >
                            {isLoading ? "Checking design originality..." : "Verify Pattern Originality"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Quiz parameters form */}
                    <div className="xl:col-span-1">
                      {result && (() => {
                        const _s = (result.status || "").toUpperCase();
                        const isRejected = _s === "REJECTED" || _s === "HISTORICAL_MATCH_FOUND";
                        return !isRejected;
                      })() ? (
                        <form onSubmit={handleGenerateProcessSheet} className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs flex flex-col gap-5">
                          <h3 className="font-display font-bold text-lg text-black">Production Parameters</h3>
                          
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">Project Name</label>
                            <input
                              type="text"
                              value={quizName}
                              onChange={(e) => setQuizName(e.target.value)}
                              placeholder="e.g. Summer Skirt Motif Dayak"
                              required
                              className="bg-slate-50 border border-zinc-200 rounded-md py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 w-full text-black font-medium"
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">Garment Type</label>
                            <select
                              value={quizGarment}
                              onChange={(e) => setQuizGarment(e.target.value)}
                              className="bg-slate-50 border border-zinc-200 rounded-md py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 w-full text-black font-medium"
                            >
                              <optgroup label="Tops">
                                <option value="Shirt">Kemeja (Shirt) — 8 Steps</option>
                                <option value="T-Shirt">Kaos (T-Shirt) — 4 Steps</option>
                                <option value="Jacket">Jaket / Outerwear — 6 Steps</option>
                              </optgroup>
                              <optgroup label="Bottoms">
                                <option value="Pants">Celana Panjang (Pants) — 6 Steps</option>
                                <option value="Skirt">Rok (Skirt) — 4 Steps</option>
                              </optgroup>
                              <optgroup label="Full-body">
                                <option value="Dress">Gaun / Dress — 5 Steps</option>
                                <option value="Hat">Topi / Hat — 5 Steps</option>
                              </optgroup>
                            </select>
                          </div>

                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">Fabric Type / Weight</label>
                            <select
                              value={quizFabric}
                              onChange={(e) => setQuizFabric(e.target.value)}
                              className="bg-slate-50 border border-zinc-200 rounded-md py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 w-full text-black font-medium"
                            >
                              <optgroup label="Light-weight">
                                <option value="Silk (Light-weight)">Sutra / Silk</option>
                                <option value="Chiffon (Light-weight)">Sifon / Chiffon</option>
                                <option value="Organza (Light-weight)">Organza</option>
                                <option value="Crepe (Light-weight)">Krep / Crepe</option>
                                <option value="Rayon (Light-weight)">Rayon / Viscose</option>
                              </optgroup>
                              <optgroup label="Medium-weight">
                                <option value="Katun (Katun/Cotton)">Katun / Cotton</option>
                                <option value="Katun (Katun/Cotton)">Katun / Cotton</option>
                                <option value="Batik (Medium-weight)">Batik Tulis & Cap</option>
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

                          <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isLoading ? "Generating Specs..." : "Compile Process Sheet"}
                          </button>
                        </form>
                      ) : result && (["REJECTED", "HISTORICAL_MATCH_FOUND"].includes((result.status || "").toUpperCase())) ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-xs flex flex-col gap-4 text-center">
                          <svg className="w-10 h-10 text-red-500 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <h3 className="font-semibold text-red-800">Production Blocked</h3>
                          <p className="text-xs text-red-700 leading-relaxed">
                            This pattern is highly similar to copyrighted records. Please adjust details or upload a new design motif.
                          </p>
                          <button
                            onClick={handleResetWorkspace}
                            className="py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs cursor-pointer"
                          >
                            Clear & Upload New
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-zinc-200 rounded-xl p-8 text-center text-xs text-slate-400 py-16">
                          Upload sketch and click check originality to unlock production options.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Unified Process Sheet Display
              <div className="w-full">
                <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
                  <div>
                    <span className="text-xs font-mono text-blue-600 font-bold uppercase tracking-widest">
                      {fullResult.is_doll_project ? "Doll Outfit Process Sheet Set" : "Process Specification Sheet"}
                    </span>
                    <h1 className="font-display font-bold text-4xl text-black mt-1">
                      {quizName}
                    </h1>
                  </div>

                  <button
                    onClick={handleResetWorkspace}
                    className="px-6 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Compile New Design
                  </button>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 animate-in fade-in duration-300">
                  {/* Left Column: Image, stats overlays and technical tags */}
                  <div className="xl:col-span-2 flex flex-col gap-6">
                    {fullResult.is_doll_project ? (
                      // Doll Outfit Previews Grid
                      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs">
                        <h2 className="font-semibold text-black text-base mb-4">Doll Outfit Components</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Array.isArray(fullResult.classification) && fullResult.classification.map((comp: any, idx: number) => {
                            // Find matching component preview URL from componentsState or default mock
                            const compKey = comp.component;
                            const compImg = componentsState[compKey]?.previewUrl || "globe.svg";
                            return (
                              <div key={idx} className="border border-zinc-200 rounded-lg overflow-hidden p-3 bg-slate-50 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-blue-600 uppercase font-mono">{compKey}</span>
                                  <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">Approved</span>
                                </div>
                                <div className="aspect-video bg-white border border-zinc-150 rounded flex items-center justify-center overflow-hidden">
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
                      // Original Single Garment Preview
                      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs relative">
                        <h2 className="font-semibold text-black text-base mb-4">Visual Layout Analysis</h2>
                        <div className="relative rounded-lg overflow-hidden border border-zinc-150 aspect-square w-full bg-slate-50 flex items-center justify-center">
                          <img
                            src={fullResult.preview_image}
                            alt="Garment Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                          
                          {/* Bounding boxes overlays */}
                          {fullResult.yolo_detections && fullResult.yolo_detections.map((det: any, idx: number) => (
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
                    )}

                    {/* Originality Metadata */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs">
                      <h3 className="font-semibold text-black text-sm mb-3">
                        {fullResult.is_doll_project ? "Doll Project Metadata" : "Pattern Metadata"}
                      </h3>
                      <div className="space-y-3.5">
                        {fullResult.is_doll_project ? (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Doll Type:</span>
                              <span className="font-semibold text-black">{fullResult.doll_type}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Total Components:</span>
                              <span className="font-semibold text-black">{fullResult.project_details?.components_count || 1} Garments</span>
                            </div>
                            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-2.5">
                              <span className="text-xs font-semibold text-slate-400">Fabric Composition:</span>
                              <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-150 space-y-1.5">
                                {Array.isArray(fullResult.classification) && fullResult.classification.map((c: any, idx: number) => {
                                  // Get matching fabric weight from project details
                                  const compKey = c.component;
                                  const fabricWeight = componentsState[compKey]?.fabricWeight || "Cotton (Medium-weight)";
                                  return (
                                    <div key={idx} className="flex justify-between text-[11px] font-semibold text-slate-600">
                                      <span className="capitalize">{compKey}:</span>
                                      <span className="text-slate-800">{fabricWeight}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Classified Motif:</span>
                              <span className="font-semibold text-black">{fullResult?.classification?.[0]?.class_name || "Original Sketch Pattern"}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Similarity Match Score:</span>
                              <span className="font-semibold text-green-600">{fullResult.similarity_percentage}% (Approved)</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Garment Category:</span>
                              <span className="font-semibold text-black">{quizGarment}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Fabric Application:</span>
                              <span className="font-semibold text-black">{quizFabric}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Step-by-Step Sewing Flow Table & Tooling Cards */}
                  <div className="xl:col-span-3 flex flex-col gap-8">
                    {/* Sewing Sequence */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs">
                      <h2 className="font-display font-semibold text-lg text-black mb-6">
                        STEP-BY-STEP SEWING FLOW
                      </h2>
                      
                      <div className="overflow-hidden border border-zinc-150 rounded-lg">
                        <table className="w-full text-left text-sm text-slate-600 border-collapse">
                          <thead className="bg-slate-50 text-[11px] font-mono text-slate-400 uppercase border-b border-zinc-150">
                            <tr>
                              <th className="py-4.5 px-6 font-bold w-16">Step</th>
                              <th className="py-4.5 px-4 font-bold">Action / Step Flow</th>
                              <th className="py-4.5 px-4 font-bold text-center w-20">Part</th>
                              <th className="py-4.5 px-6 font-bold w-52">Recommended Model</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-150 bg-white">
                            {fullResult.sewing_sequence_detailed && fullResult.sewing_sequence_detailed.length > 0 ? (
                              fullResult.sewing_sequence_detailed.map((step: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-6 font-semibold text-black">{step.step_num}</td>
                                  <td className="py-4 px-4 font-medium text-slate-700">
                                    {step.component && (
                                      <span className="inline-flex items-center text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 rounded mr-2 align-middle">
                                        {step.component}
                                      </span>
                                    )}
                                    <span className="align-middle">{step.operation}</span>
                                  </td>
                                  <td className="py-4 px-4 flex justify-center">{getPartIcon(step.operation)}</td>
                                  <td className="py-4 px-6">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-semibold text-black text-xs">{step.recommended_model}</span>
                                      <span className="text-[9px] text-slate-400 font-mono leading-none">{step.machine_type}</span>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-16 px-6 text-center">
                                  <div className="flex flex-col items-center gap-3 text-slate-400">
                                    <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                    </svg>
                                    <p className="text-sm font-medium">No sewing steps generated yet.</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tooling Grid Recommendations */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs">
                      <h2 className="font-display font-semibold text-lg text-black mb-6">
                        RECOMMENDED JUKI MACHINERY
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fullResult.tooling_recommendations && fullResult.tooling_recommendations.map((tool: any, idx: number) => (
                          <div key={idx} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full hover:border-blue-500/30 transition-all duration-300">
                            {/* Machine Photo */}
                            <div className="bg-slate-50 border-b border-zinc-200 aspect-[4/3] flex items-center justify-center p-3 relative overflow-hidden">
                              <img 
                                src={`/image/${tool.file}`} 
                                alt={tool.name}
                                className="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.parentElement) {
                                    e.currentTarget.parentElement.classList.add('bg-slate-100');
                                    e.currentTarget.parentElement.innerHTML = `<div className="flex flex-col items-center justify-center text-center p-4"><svg class="w-10 h-10 text-slate-400 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.594 15.12a2 2 0 00-1.022.548l-.066.066A2 2 0 004 17.152V19a2 2 0 002 2h12a2 2 0 002-2v-1.848a2 2 0 00-.506-1.341l-.066-.066z"/></svg><span class="text-xs font-mono font-bold text-slate-600">${tool.name}</span><span class="text-[10px] font-mono text-slate-400">JUKI Industrial Spec</span></div>`;
                                  }
                                }}
                              />
                            </div>
                            <div className="p-5 flex flex-col flex-grow">
                              <h3 className="font-semibold text-black text-sm mb-1.5">{tool.name}</h3>
                              {renderSpecsDescription(tool.desc || tool.description)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SMV & COMPLEXITY SUMMARY */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">
                            {fullResult.is_doll_project ? "TOTAL ESTIMATED OUTSET SMV" : "ESTIMATED SMV"}
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-display font-bold text-4xl text-black">
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
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                              High (Ensemble)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Doll Outfit SMV Breakdown List */}
                      {fullResult.is_doll_project && fullResult.smv_breakdown && (
                        <div className="border-t border-zinc-150 pt-4">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold block mb-2">Component SMV Breakdown</span>
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(fullResult.smv_breakdown).map(([garment, smv]: any) => (
                              <div key={garment} className="flex items-center gap-2 bg-slate-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs">
                                <span className="font-bold text-slate-500 capitalize">{garment}:</span>
                                <span className="font-semibold text-slate-800">{smv}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
            <header className="mb-10">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                All Sewing Tools Catalog
              </h1>
              <p className="text-slate-500 text-lg mb-6">
                Explore specialized Juki sewing machinery catalog, stitch technical specifications, needles, and attachments.
              </p>
              
              {/* Search catalog input */}
              <div className="max-w-md relative">
                <input 
                  type="text" 
                  placeholder="Search Juki model or machine type (e.g. DLU, lockstitch)..." 
                  value={machinerySearch}
                  onChange={(e) => setMachinerySearch(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg py-2.5 pl-10 pr-4 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {defaultMachines && defaultMachines.length > 0 ? (
                defaultMachines
                  .filter(tool => 
                    tool.name.toLowerCase().includes(machinerySearch.toLowerCase()) || 
                    (tool.desc || "").toLowerCase().includes(machinerySearch.toLowerCase())
                  )
                  .map((tool, idx) => (
                    <div key={idx} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full hover:border-blue-500/40 transition duration-300">
                      {/* Machine Photo Rendering */}
                      <div className="bg-slate-50 border-b border-zinc-200 aspect-[4/3] flex items-center justify-center p-2 relative overflow-hidden">
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
                        <h3 className="font-display font-semibold text-black text-md mb-2">{tool.name}</h3>
                        {renderSpecsDescription(tool.desc || tool.description)}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center space-y-6">
                  <div className="w-full max-w-md bg-slate-50 border border-zinc-200 rounded-xl p-6 text-center shadow-xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                      <span className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                        </span>
                        Loading Juki Machinery Catalog...
                      </span>
                      <span className="font-mono text-blue-600 font-bold">120 / 310</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full animate-pulse transition-all duration-500 w-[40%]"></div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Streaming specialized Juki tooling specifications asynchronously...</p>
                  </div>

                  {/* Skeleton Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full opacity-60">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs animate-pulse space-y-4">
                        <div className="bg-slate-200 aspect-[4/3] rounded-lg"></div>
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="space-y-2 pt-2">
                          <div className="h-3 bg-slate-100 rounded w-full"></div>
                          <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                          <div className="h-3 bg-slate-100 rounded w-4/6"></div>
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


                {/* VIEW 7: Knowledge Base */}
        {activeTab === "knowledge-view" && (
          <div className="fade-in w-full">
            <header className="mb-8">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                Knowledge Base
              </h1>
              <p className="text-slate-500 text-lg">
                Corporate engineering database, garment quality standards, and assembly reference manuals.
              </p>
            </header>

            {/* Search Input */}
            <div className="mb-6 max-w-4xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search sewing parameters, fabric guides, or garment standards..."
                  value={knowledgeSearch}
                  onChange={(e) => setKnowledgeSearch(e.target.value)}
                  className="w-full bg-white border border-zinc-250 rounded-lg py-3 px-4 pl-11 text-sm text-slate-800 focus:outline-hidden focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 placeholder-slate-400 transition"
                />
                <svg
                  className="absolute left-4 top-3.5 h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="space-y-6 max-w-4xl">
              {knowledgeBase.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-slate-500 text-sm">
                  Loading corporate reference guides and sewing parameters from database...
                </div>
              ) : (
                (() => {
                  const filtered = knowledgeBase.filter((k: any) => {
                    const term = knowledgeSearch.toLowerCase();
                    return (
                      k.title.toLowerCase().includes(term) ||
                      k.ref.toLowerCase().includes(term) ||
                      (k.features && k.features.toLowerCase().includes(term)) ||
                      (k.learnings && k.learnings.toLowerCase().includes(term))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-slate-500 text-sm">
                        No reference logs match your search.
                      </div>
                    );
                  }

                  return filtered.map((k: any, idx: number) => (
                    <div key={idx} className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs hover:border-zinc-300 transition duration-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-150 pb-4 mb-4">
                        <div>
                          <h2 className="font-display font-semibold text-xl text-black">{k.title}</h2>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{k.ref}</p>
                        </div>
                        {k.smv && k.smv !== "N/A" && (
                          <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2.5 py-1 text-xs font-medium text-slate-700">
                            SMV: <span className="font-semibold">{k.smv}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed mb-4">
                        {k.features && (
                          <div>
                            <strong className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Key Features / Material Specs</strong>
                            <p>{k.features}</p>
                          </div>
                        )}
                        {k.tooling && (
                          <div>
                            <strong className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tooling Recommendations</strong>
                            <p>{k.tooling}</p>
                          </div>
                        )}
                      </div>

                      {k.learnings && (
                        <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
                          <strong className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Guidelines & Manufacturing Learnings</strong>
                          {k.learnings}
                        </div>
                      )}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        )}

        {/* VIEW 8: Projects */}
        {activeTab === "projects-view" && (
          <div className="fade-in w-full">
            <header className="mb-10">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                Active Projects
              </h1>
              <p className="text-slate-500 text-lg">
                Manage your active garment styles, run lists, and process mappings.
              </p>
            </header>

            <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs">
              <h2 className="font-display font-semibold text-xl mb-4">Saved Projects Database</h2>
              <div className="overflow-visible border border-zinc-150 rounded-lg">
                 <table className="w-full text-left text-sm text-slate-600 border-collapse">
                  <thead className="bg-slate-50 font-mono text-xs text-slate-400 border-b border-zinc-150">
                    <tr>
                      <th className="py-4 px-6">ID</th>
                      <th className="py-4 px-6">Project Name</th>
                      <th className="py-4 px-6">Date Created</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">No active projects found. Upload sketches to populate database.</td>
                      </tr>
                    ) : (
                      analysisHistory.map((item, idx) => (
                        <tr key={idx} className="border-b border-zinc-150 hover:bg-slate-50/50">
                          <td className="py-4 px-6 font-semibold">{item.id}</td>
                          <td className="py-4 px-6 font-medium text-black">{item.fileName || item?.result?.classification?.[0]?.class_name || "Untitled Project"}</td>
                          <td className="py-4 px-6">{item.timestamp}</td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                              Analyzed
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right relative">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                              className="text-slate-400 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none"
                              aria-label="Actions Menu"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                              </svg>
                            </button>
                            
                            {activeMenuId === item.id && (
                              <div className="absolute right-6 bottom-full mb-1 z-50 bg-white border border-zinc-200 rounded-lg shadow-xl py-1.5 w-36 text-left animate-in fade-in slide-in-from-bottom-1 duration-100">
                                <button
                                  onClick={() => {
                                    handleLoadProject(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-blue-600 flex items-center gap-2 border-b border-zinc-100"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Load Specs
                                </button>
                                <button
                                  onClick={() => handleRenameProject(item.id, item.fileName || "")}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                  </svg>
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleDeleteProject(item.id)}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-zinc-100"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 9: Settings */}
        {activeTab === "settings-view" && (
          <div className="fade-in w-full">
            <header className="mb-10">
              <h1 className="font-display font-bold text-4xl text-black mb-2">
                Settings
              </h1>
              <p className="text-slate-500 text-lg">
                Configure your API hosts, model folders, and persistent database credentials.
              </p>
            </header>

            <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs max-w-4xl space-y-6">
              <div>
                <h3 className="font-semibold text-black text-sm mb-2">API Host Configuration</h3>
                <input type="text" disabled value="http://127.0.0.1:8000" className="w-full bg-slate-50 border border-zinc-200 rounded-lg p-3 text-sm font-mono text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-black text-sm mb-2">Model Weight Folder Location</h3>
                <input type="text" disabled value="./models/" className="w-full bg-slate-50 border border-zinc-200 rounded-lg p-3 text-sm font-mono text-slate-400" />
              </div>
              <div className="text-xs text-slate-400 leading-relaxed pt-4 border-t border-zinc-150">
                To switch between SQLite and PostgreSQL, update your `.env` settings at the project root and restart python server.
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
