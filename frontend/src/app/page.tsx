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

  // Multi-step wizard stepper state (1: Upload & Originality, 2: Engineering Parameters, 3: Process Sheet)
  const [currentStep, setCurrentStep] = useState(1);

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

    let activeResult = result;
    if (!activeResult && imageFile) {
      await runAnalysisForFile(imageFile);
    }
    
    if (result && ["REJECTED", "HISTORICAL_MATCH_FOUND"].includes((result.status || "").toUpperCase())) {
      alert("Duplicate pattern match detected. Process sheet creation is locked for duplicate patterns.");
      return;
    }
    
    const targetResult = result || activeResult;
    if (!targetResult) return;

    setIsLoading(true);
    try {
      const payload = {
        project_name: quizName.trim(),
        garment_type: quizGarment,
        fabric_weight: quizFabric,
        preview_image: targetResult.preview_image,
        similarity_percentage: targetResult.similarity_percentage,
        similarity_status: targetResult.status,
        classification_name: targetResult?.classification?.[0]?.class_name || "Original Pattern",
        message: targetResult.message,
        // CRITICAL: send visual_vector so backend can persist it for future cosine-similarity duplicate detection
        visual_vector: targetResult.visual_vector || []
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
    setCurrentStep(1);
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
        className={`h-full flex flex-col py-8 flex-shrink-0 transition-all duration-300 border-r border-slate-100 overflow-hidden ${
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
      <main className={`flex-grow h-full overflow-y-auto ${activeTab === "design-input-view" ? "p-0 bg-white" : "p-12"}`}>
        
        {/* VIEW 1: Pre-Production Engineering Dashboard */}
        {activeTab === "dashboard-view" && (
          <div className="fade-in w-full">
            <header className="mb-8">
              <span className="text-xs font-mono text-blue-600 font-bold uppercase tracking-widest">Pre-Production Engineering</span>
              <h1 className="font-display font-bold text-4xl text-black mt-1 mb-2">
                Engineering Dashboard
              </h1>
              <p className="text-slate-500 text-base">
                AI-assisted garment analysis, originality verification, and process sheet generation for pre-production engineering.
              </p>
            </header>

            {/* Engineering KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs hover:border-blue-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Total Analyses</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-black">{analysisHistory.length}</p>
                <p className="text-xs text-slate-400 mt-1">Engineering runs logged</p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs hover:border-green-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Unique Designs</span>
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-black">
                  {analysisHistory.filter(a => {
                    const s = (a.result?.status || "").toUpperCase();
                    return s !== "REJECTED" && s !== "HISTORICAL_MATCH_FOUND";
                  }).length}
                </p>
                <p className="text-xs text-slate-400 mt-1">Approved original patterns</p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs hover:border-amber-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Historical Matches</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-black">
                  {searchResults.length}
                </p>
                <p className="text-xs text-slate-400 mt-1">Vector DB reference records</p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs hover:border-purple-300/60 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Avg. Est. SMV</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-bold text-3xl text-black">
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
              <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-7 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-semibold text-lg text-black">Engineering Workflow</h2>
                  <button
                    onClick={() => { setActiveTab("design-input-view"); setCurrentStep(1); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Start New Analysis →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-xl bg-blue-50/50 border-blue-200/60">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">1</div>
                    <h3 className="font-semibold text-black text-sm mt-1">Upload & Originality</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Upload garment sketch. DINOv2 vector engine verifies originality against database records with 95% threshold.</p>
                  </div>
                  <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">2</div>
                    <h3 className="font-semibold text-black text-sm mt-1">Engineering Parameters</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Define project parameters — garment type, fabric weight, component breakdown, and production specifications.</p>
                  </div>
                  <div className="flex flex-col gap-2 p-5 border border-zinc-150 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">3</div>
                    <h3 className="font-semibold text-black text-sm mt-1">Process Sheet & SMV</h3>
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
                    <div className="mt-6 pt-6 border-t border-zinc-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Originality Ratio</span>
                        <span className="text-xs font-bold text-green-600">{approvedPct}% Approved</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700"
                          style={{ width: `${approvedPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-slate-400">{approved} unique designs</span>
                        <span className="text-[10px] text-slate-400">{rejected} historical matches</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: Activity Feed */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-semibold text-lg text-black">Activity Feed</h2>
                  <span className="w-2 h-2 rounded-full bg-green-500 ring-2 ring-green-200 animate-pulse" title="Live"></span>
                </div>
                {analysisHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
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
                      const timeStr = item.timestamp
                        ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "--:--";
                      return (
                        <div key={idx} className="flex gap-3 py-3 border-b border-zinc-100 last:border-0">
                          <div className="flex flex-col items-center gap-1 pt-0.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRejected ? "bg-amber-400" : "bg-blue-500"}`} />
                            {idx < analysisHistory.slice(0, 8).length - 1 && (
                              <div className="w-px flex-1 bg-zinc-150 min-h-[16px]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {isRejected ? "Historical Match Found" : "Analysis Complete"}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{item.fileName || item.result?.classification?.[0]?.class_name || "Untitled"}</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{timeStr}</span>
                        </div>
                      );
                    })}
                    {analysisHistory.length > 8 && (
                      <button
                        onClick={() => setActiveTab("projects-view")}
                        className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 text-left"
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
            if (pct >= 90) return { letter: "F", label: "Duplicate Detected",     bg: "bg-red-600",    text: "text-white",       cardBorder: "border-red-200",    cardBg: "bg-red-50/60",    rowBg: "bg-red-100",    rowText: "text-red-800" };
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
              {/* ── BANNER — Flush full-width header matching Penpot ── */}
              <div className="bg-[#155DFC] px-10 py-6 flex items-center justify-between">
                <div>
                  <h1 className="text-white font-black text-2xl tracking-wide uppercase leading-none">
                    CREATE PROCESS
                  </h1>
                  <p className="text-blue-100 text-xs mt-1 font-medium">
                    Compile industrial sewing specifications, machine allocations, and SMV timing
                  </p>
                </div>
              </div>

              {/* ── STEPPER TABS — Wide, balanced equal-width tabs matching Penpot ── */}
              <div className="bg-[#155DFC] flex items-end px-10">
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
                        if (done || (n === 2 && !isQuizSubmitted) || (n === 1 && !isQuizSubmitted)) {
                          setCurrentStep(n);
                        }
                      }}
                      className={`flex-1 py-3 text-xs font-bold rounded-t-xl select-none text-center font-mono transition-all cursor-pointer ${
                        active
                          ? "bg-white text-[#155DFC] shadow-sm -mb-px z-10"
                          : done
                          ? "bg-blue-700/50 text-blue-100 hover:bg-blue-700/70"
                          : "bg-blue-700/30 text-blue-200/70 cursor-default"
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
                          <h2 className="text-2xl font-black text-slate-900 mt-1">Select Garment Engineering Mode</h2>
                          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
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
                              <h3 className="font-bold text-slate-900 text-lg">Single Garment Specification</h3>
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
                              <h3 className="font-bold text-slate-900 text-lg">Doll Outfit Set Project</h3>
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
                                          ? `Catalog similarity: ${simPct.toFixed(1)}% — ${grade?.letter === "F" ? "Duplicate detected. Locked." : grade?.letter === "C" ? "High overlap. Review before proceeding." : grade?.letter === "B" ? "Some overlap. Proceed with caution." : "Pattern uniqueness verified."}`
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
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-700">Project / Batch Name *</label>
                            <input
                              type="text"
                              value={quizName}
                              onChange={(e) => setQuizName(e.target.value)}
                              placeholder="e.g. Autumn Casual Jacket Batch #01"
                              required
                              className="bg-slate-50/80 border border-slate-200/90 rounded-xl py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-[#155DFC] focus:ring-1 focus:ring-[#155DFC] focus:outline-none transition-colors w-full"
                            />
                          </div>
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
                          {/* Workflow Status — SecurityHeaders banner style */}
                          <div className={`border rounded-xl overflow-hidden mt-auto transition-all ${
                            grade?.letter === "F" ? "border-red-200" : grade?.letter === "C" ? "border-orange-200" : grade?.letter === "B" ? "border-amber-200" : grade ? "border-emerald-200" : "border-slate-200"
                          }`}>
                            <div className={`flex items-center justify-between px-4 py-2.5 text-xs ${wfBg} ${wfTxt}`}>
                              <span className="font-semibold">Workflow Status</span>
                              <span className="font-bold">
                                {grade?.letter === "F" ? "Locked — Duplicate Pattern Detected" : grade ? "Ready for Compilation" : "Awaiting Pattern Scan"}
                              </span>
                            </div>
                            <p className={`text-[11px] px-4 py-2.5 leading-relaxed ${
                              grade?.letter === "F" ? "bg-red-50 text-red-800" : grade?.letter === "C" ? "bg-orange-50 text-orange-800" : grade?.letter === "B" ? "bg-amber-50 text-amber-800" : grade ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"
                            }`}>
                              {grade?.letter === "F"
                                ? "Duplicate pattern detected in catalog. Process sheet generation is locked."
                                : grade
                                ? "Pattern passed originality check. Fill in the project details and click Generate Process Sheet."
                                : "Upload a garment sketch to run the DINOv2 originality scan before proceeding."}
                            </p>
                          </div>
                        </form>
                      </div>
                    </div>
                    {/* ── ANCHORED BOTTOM ACTION BAR — Clean borderless style matching Penpot reference ── */}
                    <div className="bg-white px-10 py-5 flex items-center justify-between mt-auto">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-98"
                      >
                        ← Back to Mode Choice
                      </button>
                      <button
                        type="submit"
                        form="process-sheet-form"
                        disabled={isLoading || !quizName.trim() || Boolean(isPatternRejected) || (projectMode === "single" ? (!previewUrl || !result) : !Object.values(componentsState).some(c => c.previewUrl))}
                        className="px-8 py-3 bg-[#155DFC] hover:bg-[#1249cc] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
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
                            <span>Continue / Generate</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 2 / PHASE 2: Process Sheet Output ── */}
                {isQuizSubmitted && fullResult && (
                  <div className="flex-1 p-8 flex flex-col gap-8 animate-in fade-in duration-300">
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
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
                      <div className="flex items-center gap-3">
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
                      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
                        <h2 className="font-semibold text-slate-900 text-base mb-4">Doll Outfit Components</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Array.isArray(fullResult.classification) && fullResult.classification.map((comp: any, idx: number) => {
                            const compKey = comp.component;
                            const compImg = componentsState[compKey]?.previewUrl || "globe.svg";
                            return (
                              <div key={idx} className="border border-zinc-200 rounded-lg overflow-hidden p-3 bg-slate-50 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-[#005CEA] uppercase font-mono">{compKey}</span>
                                  <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Approved</span>
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
                      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs relative">
                        <h2 className="font-semibold text-slate-900 text-base mb-4">Visual Layout Analysis</h2>
                        <div className="relative rounded-lg overflow-hidden border border-zinc-150 aspect-square w-full bg-slate-50 flex items-center justify-center">
                          <img
                            src={fullResult.preview_image}
                            alt="Garment Preview"
                            className="max-w-full max-h-full object-contain"
                          />
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
                              <span className="absolute -top-5 -left-0.5 bg-[#005CEA] text-white font-mono text-[9px] py-0.5 px-1.5 rounded-sm whitespace-nowrap">
                                {det.label} ({(det.confidence * 100).toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
                      <h3 className="font-semibold text-slate-900 text-sm mb-3">
                        {fullResult.is_doll_project ? "Doll Project Metadata" : "Pattern Metadata"}
                      </h3>
                      <div className="space-y-3.5">
                        {fullResult.is_doll_project ? (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Doll Type:</span>
                              <span className="font-semibold text-slate-900">{fullResult.doll_type}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Total Components:</span>
                              <span className="font-semibold text-slate-900">{fullResult.project_details?.components_count || 1} Garments</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Classified Motif:</span>
                              <span className="font-semibold text-slate-900">{fullResult?.classification?.[0]?.class_name || "Original Sketch Pattern"}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Similarity Score:</span>
                              <span className="font-semibold text-emerald-600">{fullResult.similarity_percentage}% (Approved)</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Garment Category:</span>
                              <span className="font-semibold text-slate-900">{quizGarment}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                              <span className="text-slate-400">Fabric Application:</span>
                              <span className="font-semibold text-slate-900">{quizFabric}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Step-by-Step Sewing Flow Table & Tooling */}
                  <div className="xl:col-span-3 flex flex-col gap-8">
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-2xs">
                      <h2 className="font-semibold text-base text-slate-900 mb-6">
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
                                  <td className="py-4 px-6 font-semibold text-slate-900">{step.step_num}</td>
                                  <td className="py-4 px-4 font-medium text-slate-700">
                                    {step.component && (
                                      <span className="inline-flex items-center text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-[#005CEA] rounded mr-2 align-middle">
                                        {step.component}
                                      </span>
                                    )}
                                    <span className="align-middle">{step.operation}</span>
                                  </td>
                                  <td className="py-4 px-4 flex justify-center">{getPartIcon(step.operation)}</td>
                                  <td className="py-4 px-6">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-semibold text-slate-900 text-xs">{step.recommended_model}</span>
                                      <span className="text-[9px] text-slate-400 font-mono leading-none">{step.machine_type}</span>
                                    </div>
                                  </td>
                                </tr>
                              ))
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
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-2xs">
                      <h2 className="font-semibold text-base text-slate-900 mb-6">
                        RECOMMENDED JUKI MACHINERY
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fullResult.tooling_recommendations && fullResult.tooling_recommendations.map((tool: any, idx: number) => (
                          <div key={idx} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs flex flex-col h-full hover:border-blue-500/30 transition-all duration-300">
                            <div className="bg-slate-50 border-b border-zinc-200 aspect-[4/3] flex items-center justify-center p-3 relative overflow-hidden">
                              <img 
                                src={`/image/${tool.file}`} 
                                alt={tool.name}
                                className="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-105"
                              />
                            </div>
                            <div className="p-5 flex flex-col flex-grow">
                              <h3 className="font-semibold text-slate-900 text-sm mb-1.5">{tool.name}</h3>
                              {renderSpecsDescription(tool.desc || tool.description)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SMV & COMPLEXITY SUMMARY */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-2xs flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-1">
                            {fullResult.is_doll_project ? "TOTAL ESTIMATED OUTSET SMV" : "ESTIMATED SMV"}
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-sans font-bold text-3xl text-slate-900">
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
                    </div>
                  </div>
                </div>
              </div>
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
            <header className="mb-8">
              <h1 className="font-display font-bold text-3xl md:text-4xl text-black tracking-tight mb-2">
                Settings
              </h1>
              <p className="text-slate-500 text-sm max-w-xl">
                Configure your API hosts, DINOv2 AI embedding engine, and persistent database credentials.
              </p>
            </header>

            <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-xs max-w-4xl space-y-6">
              <div>
                <h3 className="font-semibold text-black text-sm mb-2">API Host Configuration</h3>
                <input type="text" disabled value="http://127.0.0.1:8000" className="w-full bg-slate-50 border border-zinc-200 rounded-lg p-3 text-sm font-mono text-slate-600 font-medium" />
              </div>
              <div>
                <h3 className="font-semibold text-black text-sm mb-2">Visual Feature Extractor Engine</h3>
                <input type="text" disabled value="DINOv2 ViT-S/14 Deep Neural Embedding Engine (384-dim)" className="w-full bg-slate-50 border border-zinc-200 rounded-lg p-3 text-sm font-mono text-slate-600 font-medium" />
              </div>
              <div>
                <h3 className="font-semibold text-black text-sm mb-2">Vector Similarity Database</h3>
                <input type="text" disabled value="pgvector / SQLite Vector Indexing (Cosine Similarity Threshold: 95.0%)" className="w-full bg-slate-50 border border-zinc-200 rounded-lg p-3 text-sm font-mono text-slate-600 font-medium" />
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
