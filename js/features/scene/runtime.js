
// ==========================================
// TASCO ACCIDENT SCENE VECTOR DRAWING ENGINE
// ==========================================
let sceneCanvas = document.getElementById('sceneDrawingCanvas');

let sceneCtx = sceneCanvas ? sceneCanvas.getContext('2d') : null;


// Drawing & Interaction State
let currentDrawTool = 'select';
 // 'select', 'pen', 'line', 'dashed_line', 'rect', 'car', 'container', 'xmark', 'bike', 'person', 'measure', 'text', 'number_note', 'eraser'
let isDrawing = false;

let isDraggingShape = false;

let hasMovedDuringDrag = false;

let isRotatingShape = false;

let hasRotatedDuringDrag = false;


let startX = 0;

let startY = 0;

let currentX = 0;

let currentY = 0;

let dragStartX = 0;

let dragStartY = 0;

let originalShapeData = null;


let rotationCenter = { x: 0, y: 0 };

let initialRotationAngle = 0;

let initialShapeAngle = 0;


// Vector Object Model
let sceneShapes = [];

let sceneDiagramDataUrl = '';

let sceneDiagramShapesSnapshot = [];

let sceneTemplateMeta = null;

let sceneDiagramTemplateMetaSnapshot = null;

let sceneDiagramUpdatedAt = null;

let sceneDiagramCreatedAt = null;

let sceneDiagramLoadSequence = 0;

let lastSceneClickPos = { x: 0, y: 0 };

let priorMouseDownSelectedId = null;

let lastHitCandidates = [];

let curvePendingStart = null;

let tireTrackPendingStart = null;

let isDraggingCurveControl = false;

let isDraggingCurveStart = false;

let isDraggingCurveEnd = false;

let isResizingLinearStart = false;

let isResizingLinearEnd = false;

let isResizingInfraBand = false;

let isResizingNumberNote = false;

let isResizingVehicle = false;

let vehicleResizeHandle = null;

let infraResizeSide = 1;

let hasResizedDuringDrag = false;

let resizeOriginalShapeData = null;

let roadIntersectionResizeState = null;
let sceneGroupResizeState = null;


// Zoom & Pan State
let currentSceneZoom = 1.0;

let scenePanX = 0;

let scenePanY = 0;

let isPanning = false;

let panStartX = 0;

let panStartY = 0;

let isSpacePressed = false;

// Chế độ Bàn tay (nút trên thanh zoom): kéo chuột trái ở bất kỳ đâu để di chuyển vùng nhìn.
let sceneHandMode = false;

let sceneClipboard = null;

let selectedShapeIds = [];

let dragOriginals = [];

let rotationOriginals = [];

let rotationGroupCenter = null;

let initialGroupRotationAngle = 0;

let sceneClipboardShapes = null;

let selectedShapeId = null;

let currentTempShape = null;

let eraserHoverPos = null;

let eraserTargetShapeId = null;

let roadIntersectionHoverPos = null;


// History Stack (stores vector shape snapshots)
let drawingHistory = [];

let historyIndex = -1;


let isDrawingListenersAttached = false;

// ==========================================
// TOOLBAR FLYOUT SUBMENU SYSTEM
// ==========================================
const TOOL_ICONS_MAP = {
  road_line: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg>',
  road_dashed: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="4 3"><line x1="3" y1="12" x2="21" y2="12"></line></svg>',
  road_edge: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="21" y2="8"></line><line x1="3" y1="16" x2="21" y2="16"></line><path d="M5 8l4 8M11 8l4 8M17 8l4 8" stroke-width="1.2"></path></svg>',
  road_intersection: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 2v6H2M16 2v6h6M2 16h6v6M22 16h-6v6"></path><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke-width="1.3" stroke-dasharray="2 2"></path></svg>',
  curve: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19C4 9 9 4 19 4"></path></svg>',
  curve_dashed: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 3"><path d="M4 19C4 9 9 4 19 4"></path></svg>',
  direction_label: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4"></path><path d="M8 8l-4 4 4 4"></path><path d="M9 5h8M10 20h6"></path></svg>',
  line: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
  dashed_line: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line stroke-dasharray="4 4" x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
  bus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="1.5"></rect><path d="M19 7l3 5-3 5"></path><line x1="6" y1="9.5" x2="6" y2="14.5"></line><line x1="10" y1="9.5" x2="10" y2="14.5"></line><line x1="14" y1="9.5" x2="14" y2="14.5"></line></svg>',
  pickup: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="1"></rect><line x1="11" y1="7" x2="11" y2="17"></line><rect x="4" y="9" width="5" height="6" rx=".5"></rect><path d="M17.5 7l4.5 5-4.5 5"></path></svg>',
  ambulance: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="1.5"></rect><path d="M17.5 7l4.5 5-4.5 5"></path><path d="M8.5 9v6M5.5 12h6"></path></svg>',
  tow_truck: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="14" height="10" rx="1"></rect><line x1="4" y1="10" x2="14" y2="10"></line><line x1="4" y1="14" x2="14" y2="14"></line><rect x="17.5" y="8" width="4.5" height="8" rx="1"></rect></svg>',
  bicycle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><rect x="2" y="10.5" width="5" height="3" rx="1.5"></rect><rect x="17" y="10.5" width="5" height="3" rx="1.5"></rect><line x1="15" y1="7" x2="15" y2="17"></line></svg>',
  road_arrow_straight: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="15" y2="12"></line><polygon points="14,7 21,12 14,17" fill="currentColor"></polygon></svg>',
  road_arrow_left: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19h8V10"></path><polygon points="8.5,9.5 13,3 17.5,9.5" fill="currentColor"></polygon></svg>',
  road_arrow_right: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h8v9"></path><polygon points="8.5,14.5 13,21 17.5,14.5" fill="currentColor"></polygon></svg>',
  road_arrow_uturn: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20v-9a5 5 0 0 1 10 0v2"></path><polygon points="12.5,12.5 16,17.5 19.5,12.5" fill="currentColor"></polygon></svg>',
  traffic_island: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="5"></rect><path d="M8 16.5l4-9M12.5 16.5l4-9M4.5 14.5l2.5-5.5"></path></svg>',
  roundabout: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3.3"></circle><circle cx="12" cy="12" r="6.2" stroke-dasharray="2 2"></circle></svg>',
  railway: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="9" x2="22" y2="9"></line><line x1="2" y1="15" x2="22" y2="15"></line><path d="M5 7v10M9 7v10M13 7v10M17 7v10M21 7v10"></path></svg>',
  rail_barrier: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="5" height="8" rx="1"></rect><rect x="7" y="10.5" width="15" height="3"></rect><path d="M11 10.5v3M15 10.5v3M19 10.5v3"></path></svg>',
  sidewalk: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="22" y2="8"></line><line x1="2" y1="16" x2="22" y2="16"></line><path d="M7 8v8M12 8v8M17 8v8"></path></svg>',
  ditch: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="7" x2="22" y2="7"></line><line x1="2" y1="17" x2="22" y2="17"></line><path d="M2 12c3-3 5 3 8 0s5 3 8 0 3-1.5 4 0"></path></svg>',
  culvert: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="4" y2="18"></line><line x1="20" y1="6" x2="20" y2="18"></line><line x1="4" y1="8.5" x2="20" y2="8.5" stroke-dasharray="3 2"></line><line x1="4" y1="15.5" x2="20" y2="15.5" stroke-dasharray="3 2"></line></svg>',
  truck: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="13" height="12" rx="1"></rect><line x1="6.5" y1="8" x2="6.5" y2="16"></line><line x1="10.5" y1="8" x2="10.5" y2="16"></line><rect x="16" y="7" width="6" height="10" rx="1"></rect><path d="M18.5 7l3.5 5-3.5 5"></path></svg>',
  bridge: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5h20M2 15.5h20"></path><path d="M2 6v12M22 6v12" stroke-width="2.2"></path><path d="M6.5 8.5v7M11 8.5v7M13 8.5v7M17.5 8.5v7" stroke-width="1.1"></path><rect x="9.2" y="10.2" width="5.6" height="3.6" stroke-dasharray="1.6 1.4" stroke-width="1.1"></rect></svg>',
  toll_station: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="1" stroke-dasharray="2.5 2"></rect><rect x="3" y="4" width="2.2" height="16" rx="1"></rect><rect x="10.9" y="4" width="2.2" height="16" rx="1"></rect><rect x="18.8" y="4" width="2.2" height="16" rx="1"></rect><path d="M5.5 9h4M13.4 9h4"></path><path d="M8 19v-4M7 16l1-1 1 1M15.9 19v-4M14.9 16l1-1 1 1"></path></svg>',
  car: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1" ry="1"></rect><line x1="16" y1="6" x2="16" y2="18"></line><line x1="16" y1="6" x2="21" y2="12"></line><line x1="16" y1="18" x2="21" y2="12"></line></svg>',
  container: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="12" height="12" rx="1"></rect><rect x="14" y="8" width="2" height="8"></rect><rect x="17" y="6" width="5" height="12" rx="1"></rect><path d="M18 6l4 6-4 6"></path></svg>',
  bike: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="10.2" y="1.5" width="3.6" height="5" rx="1.8" fill="currentColor"></rect><path d="M12 6.5l-3 3v6l3 2.5 3-2.5v-6z" fill="rgba(148,163,184,.3)"></path><rect x="9.2" y="9" width="5.6" height="6" rx="2.5" fill="currentColor" opacity=".75"></rect><path d="M7 8l5 2 5-2M6 7l2 2M18 7l-2 2"></path><circle cx="6" cy="6.5" r="1.4" fill="rgba(191,219,254,.8)"></circle><circle cx="18" cy="6.5" r="1.4" fill="rgba(191,219,254,.8)"></circle><rect x="10.2" y="17.5" width="3.6" height="5" rx="1.8" fill="currentColor"></rect></svg>',
  fallen_bike: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="16" r="3.5"></circle><circle cx="19" cy="16" r="3.5"></circle><path d="M5 16l5-7 4 7H8l4-7 7 7M14 9h4l2-3M17 6h5M9 8l-3-2"></path><rect x="9" y="7" width="6" height="2.5" rx="1.2" fill="currentColor" opacity=".72"></rect><path d="M7 20c3 1 7 1 10 0" opacity=".5"></path></svg>',
  person: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21v-8a6.5 6.5 0 0 1 13 0v8"></path></svg>',
  xmark: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  rect: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect></svg>',
  crosswalk: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="7" x2="7" y2="17"></line><line x1="12" y1="7" x2="12" y2="17"></line><line x1="17" y1="7" x2="17" y2="17"></line></svg>',
  traffic_light: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="18" rx="3"></rect><circle cx="12" cy="6" r="1.8" fill="#ef4444" stroke="none"></circle><circle cx="12" cy="11" r="1.8" fill="#f59e0b" stroke="none"></circle><circle cx="12" cy="16" r="1.8" fill="#22c55e" stroke="none"></circle><line x1="12" y1="20" x2="12" y2="23"></line></svg>',
  median: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="8" rx="4"></rect><line x1="7" y1="9" x2="4" y2="15"></line><line x1="13" y1="9" x2="10" y2="15"></line><line x1="19" y1="9" x2="16" y2="15"></line></svg>',
  median_blocks: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"><path d="M2 8.5l1.5-1.5h4.8l1.4 1.5v7L8.3 17H3.5L2 15.5z"></path><path d="M9.7 8.5L11.1 7h4.8l1.4 1.5v7L15.9 17h-4.8l-1.4-1.5z"></path><path d="M17.3 8.5L18.7 7H21l1 1.5v7L21 17h-2.3l-1.4-1.5z"></path><line x1="2.5" y1="12" x2="21.5" y2="12" opacity=".55"></line></svg>',
  tire_track: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 21c0-5 3-6 3-10S7 6 8 3"></path><path d="M15 21c0-5 3-6 3-10s-2-5-1-8"></path><path d="M5.5 17h2M14.5 17h2M7 11h2M16 11h2M7 5h2M16 5h2" stroke-width="1.2"></path></svg>',
  guardrail: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 15.5c6-1 13-5 19-10.5"></path><path d="M2.5 19.5c6-1 13-5 19-10.5"></path><path d="M5 17.6c5-1.2 10-4.2 14-8.4" stroke-dasharray="2 2" opacity=".6"></path><rect x="4.2" y="15.8" width="2.6" height="2.6" fill="currentColor" stroke="none"></rect><rect x="10.7" y="12.4" width="2.6" height="2.6" fill="currentColor" stroke="none"></rect><rect x="17.2" y="7.4" width="2.6" height="2.6" fill="currentColor" stroke="none"></rect></svg>',
  utility_pole: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 6.5L9.5 20h5L13.3 6.5z" fill="rgba(148,163,184,.3)"></path><rect x="3" y="4" width="18" height="2.4" rx="1.2" fill="currentColor" opacity=".65"></rect><line x1="4" y1="2.7" x2="4" y2="8"></line><line x1="12" y1="2.7" x2="12" y2="8"></line><line x1="20" y1="2.7" x2="20" y2="8"></line><circle cx="4" cy="2.7" r="1.2" fill="white"></circle><circle cx="12" cy="2.7" r="1.2" fill="white"></circle><circle cx="20" cy="2.7" r="1.2" fill="white"></circle><rect x="8" y="20" width="8" height="2" rx="1"></rect></svg>',
  road_boundary_marker: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5h8l1.5 2v16H6.5v-16z" fill="rgba(248,250,252,.92)"></path><path d="M8 2.5h8l1.5 2v3H6.5v-3z" fill="currentColor"></path><path d="M9 11h6M9 14h6M9 17h6" stroke="currentColor" stroke-width="1.2"></path><path d="M5 20.5h14" opacity=".5"></path></svg>',
  geo_circle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"></circle></svg>',
  geo_rect: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12"></rect></svg>',
  geo_triangle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 17H3z"></path></svg>',
  geo_round_triangle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10.2 4.2a2 2 0 0 1 3.6 0l7 13.2A2 2 0 0 1 19 20H5a2 2 0 0 1-1.8-2.6z"></path></svg>',
  sign_square_post: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="14" rx="1.5"></rect><line x1="12" y1="16.5" x2="12" y2="22"></line></svg>',
  sign_rect_post: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="11" rx="1.5"></rect><line x1="12" y1="15" x2="12" y2="22"></line></svg>',
  sign_octagon_post: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 2h7L20 6.5v6L15.5 17h-7L4 12.5v-6z"></path><line x1="12" y1="17" x2="12" y2="22"></line></svg>',
  sign_circle_post: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="5"></circle><path d="M9 12v10M6 22h6"></path></svg>',
  sign_triangle_post: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 2l6 10H3z"></path><path d="M9 12v10M6 22h6"></path></svg>',
  tree: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="8"></circle><circle cx="9" cy="9" r="4"></circle><circle cx="15" cy="9" r="4"></circle><path d="M12 12v9M9 21h6"></path></svg>',
  median_tree: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="5"></rect><circle cx="7" cy="10" r="3"></circle><circle cx="12" cy="9" r="3"></circle><circle cx="17" cy="10" r="3"></circle><path d="M7 12v3M12 11v4M17 12v3"></path></svg>',
  house: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13"></rect><path d="M2.5 5.5L8 12l-5.5 6.5M21.5 5.5L16 12l5.5 6.5M8 12h8"></path></svg>',
  goods_display: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="1.5"></rect><rect x="5" y="7" width="5" height="4"></rect><path d="M7.5 7v4"></path><circle cx="16" cy="9" r="2.4"></circle><circle cx="7.5" cy="16" r="2"></circle><rect x="13.5" y="14" width="5" height="4"></rect></svg>',
  goods_damaged: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="1.5" stroke-dasharray="3 2"></rect><path d="M5 10l4-3 3 4-4 3z"></path><circle cx="16" cy="10" r="2.3"></circle><path d="M7 17l2-1 1 2M14 16l3 1-1 2"></path></svg>',
  rock_field: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l3-6 4 1 2-5 4 3 5-1-2 8z"></path><path d="M10 14l2 5M12 9l4 3"></path></svg>',
  hill: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20c3-1 4-8 8-11 3-2 5 2 7 4s4 5 5 7"></path><path d="M6 20c2-1 3-5 5-7 2-1 3 1 4 3s2 3 3 4"></path><path d="M11 20c1-1 2-3 3-3"></path></svg>',
  rice_field: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><path d="M5 7c4-2 10-2 14 0M5 12c4-2 10-2 14 0M5 17c4-2 10-2 14 0"></path><path d="M8 6v12M16 6v12"></path></svg>',
  forest: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><circle cx="7.5" cy="8.5" r="2.8" fill="rgba(113,181,104,.35)"></circle><circle cx="15.5" cy="8" r="2.8" fill="rgba(79,151,86,.35)"></circle><circle cx="11.5" cy="15" r="2.8" fill="rgba(113,181,104,.35)"></circle><circle cx="18" cy="15.5" r="2.2" fill="rgba(79,151,86,.35)"></circle><circle cx="5.5" cy="15.5" r="2.2" fill="rgba(79,151,86,.35)"></circle></svg>',
  pothole: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12c0-3.1 3.2-5.5 7.5-5.7 4.7-.3 8.4 2 8.5 5.4.1 3.5-3.2 6-7.8 6.1C7.5 18 4 15.7 4 12z" fill="rgba(100,116,139,.18)"></path><path d="M7.3 12c0-1.8 2-3.1 4.7-3.2 2.8-.1 4.9 1.2 4.9 3s-2 3.2-4.7 3.3c-2.8.1-4.9-1.2-4.9-3.1z" fill="rgba(51,65,85,.28)"></path></svg>'
};


// Bảng công cụ chia theo CHỨC NĂNG (id công cụ giữ nguyên để bản vẽ đã lưu vẫn dùng được).
// Thứ tự khai báo = thứ tự nút trên thanh công cụ:
//   Vẽ nét      : road_line, curve, arrow
//   Hình & ký hiệu : shape_symbols, traffic_signs
//   Hiện trường : scene_object, two_wheel, evidence, structures
//   Hạ tầng & cảnh quan : junction, roadside, road_assets, landscape
const TOOL_GROUPS_CONFIG = {
  road_line: {
    id: 'road_line',
    name: 'Vạch kẻ & mũi tên mặt đường',
    defaultTool: 'road_line',
    tools: [
      { id: 'road_line', name: 'Vạch kẻ nét liền', desc: 'Vạch tim đường, vạch giới hạn phần xe chạy' },
      { id: 'road_dashed', name: 'Vạch kẻ nét đứt', desc: 'Vạch phân chia làn đường đứt' },
      { id: 'crosswalk', name: 'Vạch người đi bộ', desc: 'Kéo để tạo cụm vạch sang đường' },
      { id: 'road_arrow_straight', name: 'Mũi tên mặt đường — đi thẳng', desc: 'Kéo theo chiều xe chạy; mũi tên sơn trên mặt đường' },
      { id: 'road_arrow_left', name: 'Mũi tên mặt đường — rẽ trái', desc: 'Kéo theo chiều xe chạy; nhánh rẽ về bên trái' },
      { id: 'road_arrow_right', name: 'Mũi tên mặt đường — rẽ phải', desc: 'Kéo theo chiều xe chạy; nhánh rẽ về bên phải' },
      { id: 'road_arrow_uturn', name: 'Mũi tên mặt đường — quay đầu', desc: 'Kéo theo chiều xe chạy; vòng ngược lại phía sau' }
    ]
  },
  curve: {
    id: 'curve',
    name: 'Đường cong',
    defaultTool: 'curve',
    tools: [
      { id: 'curve', name: 'Đường cong nét liền', desc: 'Khúc cua, lề bo tròn' },
      { id: 'curve_dashed', name: 'Đường cong nét đứt', desc: 'Khúc cua phân làn đứt' }
    ]
  },
  arrow: {
    id: 'arrow',
    name: 'Mũi tên hướng đi',
    defaultTool: 'line',
    tools: [
      { id: 'line', name: 'Mũi tên nét liền', desc: 'Hướng di chuyển chính của xe' },
      { id: 'dashed_line', name: 'Mũi tên nét đứt', desc: 'Đường đi dự kiến của xe' },
      { id: 'direction_label', name: 'Hướng về… (mũi tên + chữ)', desc: 'Kéo theo hướng đi, nhập tên nơi đến (VD: Hướng về Buôn Hồ)' }
    ]
  },
  shape_symbols: {
    id: 'shape_symbols',
    name: 'Hình học',
    defaultTool: 'geo_circle',
    tools: [
      { id: 'geo_circle', name: 'Hình tròn', desc: 'Kéo để vẽ đường tròn rỗng' },
      { id: 'geo_rect', name: 'Hình chữ nhật', desc: 'Kéo để vẽ; kéo cạnh để đổi dài/rộng, kéo góc để phóng to theo tỷ lệ' },
      { id: 'geo_triangle', name: 'Hình tam giác', desc: 'Tam giác cạnh thẳng' },
      { id: 'geo_round_triangle', name: 'Tam giác bo góc', desc: 'Tam giác được bo mềm tại ba đỉnh' }
    ]
  },
  traffic_signs: {
    id: 'traffic_signs',
    name: 'Biển báo & tín hiệu',
    defaultTool: 'sign_circle_post',
    tools: [
      { id: 'sign_circle_post', name: 'Biển báo tròn có trụ', desc: 'Mặt biển tròn và trụ đỡ đơn sắc' },
      { id: 'sign_triangle_post', name: 'Biển báo tam giác có trụ', desc: 'Mặt biển tam giác và trụ đỡ đơn sắc' },
      { id: 'sign_square_post', name: 'Biển báo vuông có trụ', desc: 'Mặt biển vuông (VD: biển chỉ dẫn P đỗ xe); nhấp đúp để đổi nội dung' },
      { id: 'sign_rect_post', name: 'Biển báo chữ nhật có trụ', desc: 'Mặt biển chữ nhật ghi chữ (VD: QL14, Km12); nhấp đúp để đổi nội dung' },
      { id: 'sign_octagon_post', name: 'Biển STOP bát giác có trụ', desc: 'Biển dừng lại hình bát giác có trụ' },
      { id: 'traffic_light', name: 'Đèn tín hiệu', desc: 'Đèn đỏ, vàng, xanh có thể xoay' }
    ]
  },
  scene_object: {
    id: 'scene_object',
    name: 'Ô tô & xe tải',
    defaultTool: 'car',
    tools: [
      { id: 'car', name: 'Xe ô tô', desc: 'Ký hiệu ô tô con hiện trường' },
      { id: 'pickup', name: 'Xe bán tải', desc: 'Cabin phía trước, thùng hở phía sau' },
      { id: 'truck', name: 'Xe tải', desc: 'Thùng hàng, cabin và cầu sau đôi nhìn từ trên' },
      { id: 'container', name: 'Xe container', desc: 'Đầu kéo và thùng container nhìn từ trên' },
      { id: 'bus', name: 'Xe khách / buýt', desc: 'Thân dài có dãy cửa sổ; kéo dọc theo chiều xe' },
      { id: 'ambulance', name: 'Xe cứu thương', desc: 'Xe van có dấu thập ở khoang cứu thương' },
      { id: 'tow_truck', name: 'Xe cứu hộ', desc: 'Sàn nâng chở xe có ray và mặt dốc phía sau' }
    ]
  },
  two_wheel: {
    id: 'two_wheel',
    name: 'Xe 2 bánh & người',
    defaultTool: 'bike',
    tools: [
      { id: 'bike', name: 'Xe máy', desc: 'Mô tô, xe gắn máy 2 bánh' },
      { id: 'fallen_bike', name: 'Xe máy nằm ngã', desc: 'Xe máy đổ nghiêng, nằm trên mặt đường' },
      { id: 'bicycle', name: 'Xe đạp', desc: 'Xe đạp, xe đạp điện nhìn từ trên; kéo theo hướng đi' },
      { id: 'person', name: 'Người / Nạn nhân', desc: 'Vị trí người đi bộ, nạn nhân' }
    ]
  },
  evidence: {
    id: 'evidence',
    name: 'Dấu vết & vật chứng',
    defaultTool: 'xmark',
    tools: [
      { id: 'xmark', name: 'Điểm va chạm (X)', desc: 'Vị trí va chạm, xung đột' },
      { id: 'tire_track', name: 'Vệt bánh xe cong', desc: 'Nhấp điểm đầu, xem trước đường cong rồi nhấp điểm cuối' },
      { id: 'goods_damaged', name: 'Hàng hóa đổ vỡ', desc: 'Vùng gạch chéo có hàng đổ nghiêng, mảnh vỡ; dùng cho tài sản bị thiệt hại' },
      { id: 'pothole', name: 'Ổ gà', desc: 'Hố mặt đường bất quy tắc có các vết nứt xung quanh' }
    ]
  },
  structures: {
    id: 'structures',
    name: 'Nhà & vật cản',
    defaultTool: 'house',
    tools: [
      { id: 'house', name: 'Nhà (mái 4 mái)', desc: 'Kéo chéo góc → góc như vẽ hình chữ nhật; bấm 1 cái tạo nhà mặc định' },
      { id: 'goods_display', name: 'Hàng hóa trưng bày', desc: 'Bàn/kệ hàng hóa (thùng, nồi, ấm...); kéo rộng để thêm hàng' },
      { id: 'rect', name: 'Khối hộp / Vật cản', desc: 'Khung chữ nhật rỗng cho vật cản; hộ lan dùng công cụ Hộ lan tôn sóng' }
    ]
  },
  junction: {
    id: 'junction',
    name: 'Nút giao & đường sắt',
    defaultTool: 'road_intersection',
    tools: [
      { id: 'road_intersection', name: 'Ngã tư đường', desc: 'Mẫu 4 nhánh có mép đường và vạch tim; nhấp để đặt' },
      { id: 'roundabout', name: 'Vòng xuyến', desc: 'Đảo tròn giữa, vạch tim đứt, mũi tên ngược chiều kim đồng hồ; kéo để đổi cỡ' },
      { id: 'traffic_island', name: 'Đảo giao thông', desc: 'Đảo dẫn hướng có bó vỉa và gạch chéo; kéo theo chiều dài đảo' },
      { id: 'railway', name: 'Đường sắt', desc: 'Hai ray song song có tà vẹt; kéo dọc theo tuyến' },
      { id: 'rail_barrier', name: 'Thanh chắn tàu', desc: 'Hộp đế và cần chắn sọc; kéo theo chiều cần chắn' }
    ]
  },
  roadside: {
    id: 'roadside',
    name: 'Lề đường & thoát nước',
    defaultTool: 'road_edge',
    tools: [
      { id: 'road_edge', name: 'Lề đường', desc: 'Hai mép song song có vạch nối, dùng thể hiện lề hoặc bó vỉa' },
      { id: 'sidewalk', name: 'Vỉa hè', desc: 'Hai bó vỉa và mạch gạch lát; kéo dọc theo vỉa hè' },
      { id: 'ditch', name: 'Mương thoát nước', desc: 'Hai bờ mương và đường nước lượn sóng' },
      { id: 'culvert', name: 'Cống ngang đường', desc: 'Ống nét đứt dưới mặt đường, hai đầu có tường đầu cống' }
    ]
  },
  road_assets: {
    id: 'road_assets',
    name: 'Hạ tầng đường bộ',
    defaultTool: 'guardrail',
    tools: [
      { id: 'guardrail', name: 'Hộ lan tôn sóng', desc: 'Nhấp điểm đầu và điểm cuối; kéo chấm giữa để uốn cong theo đường' },
      { id: 'median', name: 'Dải phân cách cứng', desc: 'Dải bê tông liền khối có gạch chéo' },
      { id: 'median_blocks', name: 'Dải phân cách ghép khối', desc: 'Các mô-đun bê tông ghép nối, có khe phân khối rõ ràng' },
      { id: 'toll_station', name: 'Trạm thu phí', desc: 'Mái che, buồng thu phí, đảo phân làn và barie; kéo rộng để thêm làn' },
      { id: 'bridge', name: 'Cầu', desc: 'Kéo dọc theo chiều cầu; chọn cầu để đặt tên, kéo tay nắm đổi dài/rộng' },
      { id: 'utility_pole', name: 'Trụ điện', desc: 'Trụ, xà ngang và sứ điện nhìn trên sơ đồ' },
      { id: 'road_boundary_marker', name: 'Cột mốc lộ giới', desc: 'Mốc bê tông đơn sắc dùng trên sơ đồ' }
    ]
  },
  landscape: {
    id: 'landscape',
    name: 'Cảnh quan & địa hình',
    defaultTool: 'tree',
    tools: [
      { id: 'tree', name: 'Cây xanh', desc: 'Tán cây nhìn từ trên xuống' },
      { id: 'median_tree', name: 'Cây trên dải phân cách', desc: 'Dải phân cách trồng nhiều cây xanh' },
      { id: 'rice_field', name: 'Đồng lúa', desc: 'Khoảnh ruộng có luống và biểu tượng cây lúa' },
      { id: 'forest', name: 'Rừng cây', desc: 'Khu rừng nhiều tán cây, kéo rộng để thêm cây' },
      { id: 'rock_field', name: 'Bãi đá', desc: 'Khối đá góc cạnh; kéo rộng để thêm đá, chọn "Vẽ ranh giới" để bám theo sườn núi' },
      { id: 'hill', name: 'Đồi núi', desc: 'Đường đồng mức quanh đỉnh; chọn "Vẽ ranh giới" để bám theo địa hình thật' }
    ]
  }
};


// Công cụ đang chọn gần nhất của từng nhóm (nút nhóm hiện icon và phím tắt kích hoạt công cụ này).
const groupActiveTools = {
  road_line: 'road_line',
  curve: 'curve',
  arrow: 'line',
  shape_symbols: 'geo_circle',
  traffic_signs: 'sign_circle_post',
  scene_object: 'car',
  two_wheel: 'bike',
  evidence: 'xmark',
  structures: 'house',
  junction: 'road_intersection',
  roadside: 'road_edge',
  road_assets: 'guardrail',
  landscape: 'tree'
};


let activeSubmenuGroup = null;

const SCENE_LOGICAL_WIDTH = 1000;

const SCENE_LOGICAL_HEIGHT = 700;


const ROTATE_CURSOR = 'crosshair';


// ==========================================
// SMART SNAPPING & ALIGNMENT GUIDES SYSTEM
// ==========================================
let activeSnapGuides = [];


let lastRenderedZoom = 1.0;


let editingTrafficSignId = null;


const TRAFFIC_SIGN_KIND_OPTIONS = [
  { value: 'speed_limit', label: 'Giới hạn tốc độ', badge: '50' },
  { value: 'priority_road', label: 'I.401 — Bắt đầu đường ưu tiên', badge: '401' },
  { value: 'end_priority', label: 'I.402 — Hết đoạn đường ưu tiên', badge: '402' },
  { value: 'warning_turn_left', label: 'W.201a — Chỗ ngoặt nguy hiểm bên trái', badge: '201a' },
  { value: 'warning_turn_right', label: 'W.201b — Chỗ ngoặt nguy hiểm bên phải', badge: '201b' },
  { value: 'warning_winding', label: 'W.202 — Nhiều chỗ ngoặt nguy hiểm liên tiếp', badge: '202' },
  { value: 'warning_narrow_both', label: 'W.203a — Đường bị hẹp cả hai bên', badge: '203a' },
  { value: 'warning_two_way', label: 'W.204 — Đường hai chiều', badge: '204' },
  { value: 'warning_crossroads', label: 'W.205a — Giao nhau với đường đồng cấp', badge: '205a' },
  { value: 'warning_roundabout', label: 'W.206 — Giao nhau chạy theo vòng xuyến', badge: '206' },
  { value: 'warning_traffic_signal', label: 'W.209 — Giao nhau có tín hiệu đèn', badge: '209' },
  { value: 'warning_railway', label: 'W.211 — Giao nhau với đường sắt không có rào chắn', badge: '211' },
  { value: 'warning_slippery', label: 'W.222 — Đường trơn', badge: '222' },
  { value: 'warning_pedestrian', label: 'W.224 — Đường người đi bộ cắt ngang', badge: '224' },
  { value: 'intersection_non_priority', label: 'W.207a — Giao nhau với đường không ưu tiên', badge: '207a' },
  { value: 'intersection_non_priority_right', label: 'W.207b — Giao nhau với đường không ưu tiên bên phải', badge: '207b' },
  { value: 'intersection_non_priority_left', label: 'W.207c — Giao nhau với đường không ưu tiên bên trái', badge: '207c' },
  { value: 'yield', label: 'Nhường đường', badge: '▽' },
  { value: 'stop', label: 'Dừng lại (STOP)', badge: 'STOP' },
  { value: 'no_entry', label: 'Cấm đi ngược chiều', badge: '—' },
  { value: 'no_parking', label: 'Cấm đỗ xe', badge: 'P' },
  { value: 'no_overtaking', label: 'Cấm vượt', badge: '↔' },
  { value: 'children', label: 'Trẻ em', badge: '2' },
  { value: 'roadworks', label: 'Công trường đang thi công', badge: '!' },
  { value: 'danger', label: 'Nguy hiểm khác', badge: '!' },
  { value: 'custom', label: 'Ký hiệu tùy chỉnh', badge: 'Aa' }
];


// ------------------------------------------
// STROKE WIDTH & COLOR CONTROLLER LOGIC
// ------------------------------------------
let isStrokePopoverOpen = false;


// Global click outside listener to close popover
document.addEventListener('click', function(e) {
  const popover = document.getElementById('strokeWidthPopover');
  const btn = document.getElementById('btnStrokeWidthToggle');
  const badgeBtn = document.getElementById('selectedStrokeBadge');
  if (!popover || !isStrokePopoverOpen) return;
  if (!popover.contains(e.target) && (!btn || !btn.contains(e.target)) && (!badgeBtn || !badgeBtn.contains(e.target))) {
    isStrokePopoverOpen = false;
    popover.style.display = 'none';
    if (badgeBtn) badgeBtn.setAttribute('aria-expanded', 'false');
    if (btn) {
      btn.style.borderColor = 'var(--border)';
      btn.style.background = 'var(--surface)';
    }
  }
});


// Quick tool selection. Group shortcuts reactivate the most recently used item
// in that group, so the letter keys stay useful after the user customizes a tool.
const SCENE_TOOL_SHORTCUTS = Object.freeze({
  v: { tool: 'select' },
  p: { tool: 'pen' },
  l: { group: 'road_line' },
  c: { group: 'curve' },
  a: { group: 'arrow' },
  s: { group: 'shape_symbols' },
  b: { group: 'traffic_signs' },
  o: { group: 'scene_object' },
  x: { group: 'two_wheel' },
  d: { group: 'evidence' },
  k: { group: 'structures' },
  j: { group: 'junction' },
  y: { group: 'roadside' },
  h: { group: 'road_assets' },
  g: { group: 'landscape' },
  m: { tool: 'measure' },
  t: { tool: 'text' },
  n: { tool: 'number_note' },
  e: { tool: 'eraser' }
});


// Keyboard shortcuts: V/P/L/C/A/S/B/O/X/D/K/J/Y/H/G/M/T/N/E (tools), R / Shift+R
// (rotate), Esc (cancel), Delete/Backspace (delete), arrows (nudge).
document.addEventListener('keydown', function(e) {
  const modal = document.getElementById('sceneDrawingModalOverlay');
  if (!modal || modal.style.display === 'none') return;

  if (e.key === 'Escape') {
    e.preventDefault();
    const metaOverlay = document.getElementById('sceneTemplateMetaOverlay');
    const numberOverlay = document.getElementById('sceneNumberNoteModalOverlay');
    const textOverlay = document.getElementById('sceneTextModalOverlay');
    const trafficSignOverlay = document.getElementById('sceneTrafficSignOverlay');
    if (trafficSignOverlay && trafficSignOverlay.style.display !== 'none') {
      closeTrafficSignEditor();
    } else if (metaOverlay && metaOverlay.style.display !== 'none') {
      closeSceneTemplateMetaEditor();
    } else if (numberOverlay && numberOverlay.style.display !== 'none') {
      closeSceneNumberNoteModal();
    } else if (textOverlay && textOverlay.style.display !== 'none') {
      closeSceneTextModal();
    } else {
      cancelSceneCanvasInteraction();
    }
    return;
  }
  
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) return;
  
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) {
      redoSceneDrawing();
    } else {
      undoSceneDrawing();
    }
    return;
  }
  
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redoSceneDrawing();
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedShapeId) {
      e.preventDefault();
      deleteSelectedShape();
      return;
    }
  }

  // Chọn tất cả: Ctrl + A
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    selectAllSceneShapes();
    return;
  }

  // Group: Ctrl + G, Ungroup: Ctrl + Shift + G
  if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
    e.preventDefault();
    if (e.shiftKey) {
      ungroupSelectedShapes();
    } else {
      groupSelectedShapes();
    }
    return;
  }

  // Arrow keys to nudge selected shape(s)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    const sel = getSelectedShapes();
    if (sel.length > 0) {
      const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        for (let i = 0; i < sel.length; i++) {
          moveShapeBy(sel[i], dx, dy);
        }
        redrawSceneCanvas(true);
        saveDrawingState();
        return;
      }
    }
  }

  // Duplicate: Ctrl + D
  if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
    if (selectedShapeId) {
      e.preventDefault();
      duplicateSelectedShape();
      return;
    }
  }

  // Copy: Ctrl + C
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    if (selectedShapeId) {
      e.preventDefault();
      copySelectedShape();
      return;
    }
  }

  // Paste: Ctrl + V
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    if (sceneClipboard) {
      e.preventDefault();
      pasteCopiedShape();
      return;
    }
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    if (currentDrawTool === 'select') {
      cycleOverlappingSelection();
    } else {
      setActiveDrawTool('select');
      cycleOverlappingSelection();
    }
    return;
  }

  if (selectedShapeId) {
    if ((e.ctrlKey || e.metaKey) && e.key === ']') {
      e.preventDefault();
      if (e.shiftKey) {
        bringShapeToFront();
      } else {
        bringShapeForward();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '[') {
      e.preventDefault();
      if (e.shiftKey) {
        sendShapeToBack();
      } else {
        sendShapeBackward();
      }
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      bringShapeForward();
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      sendShapeBackward();
      return;
    }
  }

  if (selectedShapeId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const shape = sceneShapes.find(s => s.id === selectedShapeId);
    if (shape) {
      const step = e.shiftKey ? 10 : 2;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      moveShapeBy(shape, dx, dy);
      redrawSceneCanvas(true);
      saveDrawingState();
    }
    return;
  }

  // Zoom shortcuts work with both the main keyboard and numeric keypad.
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    zoomSceneCanvas(0.15);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
    e.preventDefault();
    zoomSceneCanvas(-0.15);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    resetSceneZoom();
    return;
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (selectedShapeId && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      rotateSelectedShape(e.shiftKey ? -45 : 45);
      return;
    }
    if (selectedShapeId && e.key === '[') {
      e.preventDefault();
      rotateSelectedShape(-15);
      return;
    }
    if (selectedShapeId && e.key === ']') {
      e.preventDefault();
      rotateSelectedShape(15);
      return;
    }
    if (e.key === '+') {
      e.preventDefault();
      zoomSceneCanvas(0.15);
      return;
    }
    if (e.key === '-') {
      e.preventDefault();
      zoomSceneCanvas(-0.15);
      return;
    }
    if (e.code === 'Space' && !isSpacePressed) {
      isSpacePressed = true;
      const vp = document.getElementById('sceneCanvasViewport');
      if (vp) vp.style.cursor = 'grab';
      if (sceneCanvas) sceneCanvas.style.cursor = 'grab';
      e.preventDefault();
      return;
    }
    if (!e.repeat && activateSceneToolShortcut(e.key)) {
      e.preventDefault();
      return;
    }
  }
});


window.addEventListener('keyup', function(e) {
  if (e.code === 'Space') {
    isSpacePressed = false;
    const vp = document.getElementById('sceneCanvasViewport');
    if (vp) vp.style.cursor = '';
    if (!isPanning && sceneCanvas) {
      sceneCanvas.style.cursor = (currentDrawTool === 'select') ? 'default' : 'crosshair';
    }
  }
});


let sceneRailScrollFadeTimer = null;


// Khởi tạo nền vẽ trước khi mở modal
setTimeout(function() {
  if (typeof sceneCanvas !== 'undefined' && sceneCanvas && typeof sceneCtx !== 'undefined' && sceneCtx) {
    redrawSceneCanvas(false);
  }
}, 60);


// ==========================================
// TEXT MODAL & TYPOGRAPHY LOGIC
// ==========================================
let pendingNumberNotePos = { x: 200, y: 200 };

let editingNumberNoteId = null;


let pendingTextPos = { x: 200, y: 200 };

let editingTextShapeId = null;

let currentTextFontSize = 16;

let currentTextFontFamily = 'Arial';

let isTextBold = false;

let isTextItalic = false;

let isTextUnderline = false;

let currentTextColor = '#000000';



// Shared premium selects retain the original values and change handlers.
const adminSelectWidgets = new WeakMap();

let activeAdminSelect = null;

let adminSelectSequence = 0;

document.addEventListener('pointerdown', event => {
  if (activeAdminSelect && !activeAdminSelect.wrapper.contains(event.target) && !activeAdminSelect.menu.contains(event.target)) closeAdminSelect();
});

document.addEventListener('scroll', event => {
  if (activeAdminSelect && !activeAdminSelect.menu.contains(event.target)) closeAdminSelect();
}, true);

window.addEventListener('resize', () => closeAdminSelect());

document.addEventListener('DOMContentLoaded', () => {
  syncAdminSelects();
  const root = document.getElementById('appRoot');
  if (root) new MutationObserver(() => {
    if (activeAdminSelect && !activeAdminSelect.trigger.isConnected) closeAdminSelect();
    syncAdminSelects(root);
  }).observe(root, { childList:true, subtree:true });
});


const collectionGuideBranchAddress='Tầng 5 Toà nhà VIB Đắk Lắk, Số 27 Nguyễn Tất Thành, Phường Buôn Ma Thuột, Tỉnh Đắk Lắk';

const collectionGuidePreviousAddress='Tầng 7, Tòa nhà Tasco, Phạm Hùng, Mễ Trì, Từ Liêm, Hà Nội';

let collectionGuideContactDirectory=null,collectionGuideContactDirectoryPromise=null,collectionGuideContactDirectoryUser='';

const collectionGuideContactState=new WeakMap();

document.addEventListener('input',event=>{
  if(event.target.id==='tndsAdvance_assessor'&&collectionGuideDraft?.tndsAdvance){
    const phone=collectionGuideFindAssessorPhone(event.target.value).phone,input=document.getElementById('tndsAdvance_hotline');
    if(input)input.value=phone;collectionGuideDraft.tndsAdvance.hotline=phone;return;
  }
  if(!['modalPendingCanBoXuLy','modalPendingGdvTiepNhan'].includes(event.target.id)||!collectionGuideDraft)return;
  const assessor=collectionGuideValue('modalPendingCanBoXuLy')||collectionGuideValue('modalPendingGdvTiepNhan');
  collectionGuideDraft.meta.assessor=assessor;
  const input=document.getElementById('collectionGuideMeta_assessor');if(input)input.value=assessor;
  refreshCollectionGuideMetaSummary();collectionGuideSyncContactPhone(true);void collectionGuidePrepareContact();
});


// Local document edits are scoped to the exact claim, form state and template version.
const collectionDocumentDraftCache = new Map();



