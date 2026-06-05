<template>
  <!-- Login Screen -->
  <div v-if="!loggedIn" class="login-wrapper">
    <div class="login-glow"></div>
    <div class="login-card glass-panel">
      <div class="login-header">
        <div class="login-logo-icon">
          <CloudIcon class="w-8 h-8 text-cyan" />
        </div>
        <h2>WebDAV<span>MGMT</span></h2>
        <p>Acesse o servidor de arquivos de forma segura</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Usuário</label>
          <input 
            type="text" 
            v-model="loginUser" 
            required 
            placeholder="Nome de usuário" 
            autofocus
          />
        </div>
        <div class="form-group">
          <label>Senha</label>
          <input 
            type="password" 
            v-model="loginPass" 
            required 
            placeholder="Senha de acesso" 
          />
        </div>
        
        <button type="submit" class="btn btn-primary login-submit-btn" :disabled="authenticating">
          <RefreshCwIcon v-if="authenticating" class="w-4 h-4 animate-spin" />
          <span v-if="authenticating">Autenticando...</span>
          <span v-else>Entrar</span>
        </button>
      </form>
    </div>
  </div>

  <!-- Main System Layout -->
  <div v-else class="app-container">
    <!-- Top Nav Header -->
    <header class="top-header glass-panel">
      <div class="logo-area">
        <div class="logo-icon">
          <CloudIcon class="w-6 h-6 text-cyan" />
        </div>
        <div class="logo-text">
          <h1>WebDAV<span>MGMT</span></h1>
          <span class="status-badge connected">
            <span class="status-dot"></span> Conectado
          </span>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-wrapper">
        <SearchIcon class="search-icon" />
        <input 
          type="text" 
          placeholder="Pesquisar arquivos e pastas..." 
          v-model="searchQuery" 
        />
      </div>

      <!-- Action Area -->
      <div class="header-actions">
        <!-- User Badge -->
        <div class="user-badge">
          <UserIcon class="w-4 h-4 text-cyan" />
          <span>{{ username }}</span>
        </div>
        
        <button class="btn btn-primary" @click="triggerFileInput">
          <UploadIcon class="w-4 h-4" />
          Upload
        </button>
        <button class="btn" @click="showNewFolderModal = true">
          <FolderPlusIcon class="w-4 h-4" />
          Nova Pasta
        </button>
        <button 
          v-if="clipboard" 
          class="btn btn-primary animate-fade-in" 
          @click="pasteItem"
          :title="`Colar ${clipboard.name} aqui`"
        >
          <ClipboardIcon class="w-4 h-4" />
          Colar
        </button>
        <button class="btn btn-icon" @click="loadCurrentDirectory" :disabled="loading" title="Atualizar">
          <RefreshCwIcon :class="['w-4 h-4', { 'animate-spin': loading }]" />
        </button>
        <button class="btn btn-danger btn-icon" @click="handleLogout" title="Sair do Sistema">
          <LogOutIcon class="w-4 h-4" />
        </button>
        
        <input 
          type="file" 
          ref="fileInput" 
          style="display: none" 
          @change="handleFileUpload" 
          multiple 
        />
      </div>
    </header>

    <div class="main-layout">
      <!-- Sidebar -->
      <aside class="sidebar glass-panel">
        <div class="sidebar-section">
          <h3>Navegação</h3>
          <ul class="nav-list">
            <li 
              v-for="cat in categories" 
              :key="cat.id" 
              :class="{ active: activeCategory === cat.id }"
              @click="activeCategory = cat.id"
            >
              <component :is="cat.icon" class="nav-icon" />
              <span>{{ cat.name }}</span>
              <span class="count-badge" v-if="getCategoryCount(cat.id) > 0">
                {{ getCategoryCount(cat.id) }}
              </span>
            </li>
          </ul>
        </div>

        <div class="sidebar-section storage-overview">
          <h3>Armazenamento</h3>
          <div class="storage-card glass-card">
            <div class="storage-info">
              <span>Carregados</span>
              <strong>{{ formatBytes(totalSize) }}</strong>
            </div>
            <div class="storage-bar">
              <div class="storage-progress" :style="{ width: '35%' }"></div>
            </div>
            <div class="storage-stats">
              <span>{{ totalFiles }} Arquivos</span>
              <span>{{ totalFolders }} Pastas</span>
            </div>
          </div>
        </div>
        
        <div class="sidebar-footer">
          <p>WebDAV Server @ 172.16.0.99</p>
        </div>
      </aside>

      <!-- Content Area -->
      <main class="content-area">
        <!-- Breadcrumbs & Toolbar -->
        <div class="toolbar-area glass-panel">
          <div class="breadcrumbs">
            <span class="breadcrumb-item" @click="navigateTo('/')">
              <HomeIcon class="w-4 h-4 inline-block align-text-bottom" /> /
            </span>
            <template v-for="(part, idx) in pathParts" :key="idx">
              <span class="breadcrumb-item" @click="navigateToIndex(idx)">
                {{ part }}
              </span>
              <span class="breadcrumb-separator" v-if="idx < pathParts.length - 1">/</span>
            </template>
          </div>

          <!-- Clipboard Actions -->
          <div class="clipboard-actions-bar animate-fade-in" v-if="clipboard">
            <button class="btn btn-primary" @click="pasteItem" :title="`Colar aqui`">
              <ClipboardIcon class="w-4 h-4" />
              Colar ({{ clipboard.operation === 'copy' ? 'Copiar' : 'Mover' }}: {{ clipboard.name }})
            </button>
            <button class="btn btn-icon btn-danger" @click="clipboard = null" title="Cancelar">
              <XIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- View Toggle & Sort -->
          <div class="toolbar-controls">
            <select v-model="sortBy" class="sort-select">
              <option value="name">Nome</option>
              <option value="size">Tamanho</option>
              <option value="date">Data de Modificação</option>
            </select>
            
            <div class="view-toggle">
              <button 
                :class="['btn btn-icon', { active: viewMode === 'grid' }]" 
                @click="viewMode = 'grid'"
                title="Grade"
              >
                <LayoutGridIcon class="w-4 h-4" />
              </button>
              <button 
                :class="['btn btn-icon', { active: viewMode === 'list' }]" 
                @click="viewMode = 'list'"
                title="Lista"
              >
                <ListIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Files Display -->
        <div class="files-container">
          <div v-if="loading" class="empty-state">
            <RefreshCwIcon class="w-12 h-12 animate-spin text-cyan" />
            <p>Carregando arquivos do WebDAV...</p>
          </div>
          
          <div v-else-if="filteredItems.length === 0" class="empty-state">
            <FolderOpenIcon class="w-16 h-16 text-muted" />
            <h3>Nenhum item encontrado</h3>
            <p>Esta pasta está vazia ou os filtros não correspondem.</p>
          </div>

          <div v-else :class="viewMode === 'grid' ? 'files-grid' : 'files-list'">
            <!-- Folder Items First -->
            <div 
              v-for="item in sortedFolders" 
              :key="item.path"
              :class="['glass-card file-item', viewMode === 'grid' ? 'file-card' : 'file-row', { selected: selectedItem?.path === item.path }]"
              @click="selectItem(item)"
              @dblclick="openDirectory(item.path)"
            >
              <div class="file-icon-wrapper">
                <FolderIcon class="w-10 h-10 folder-icon" />
              </div>
              <div class="file-details">
                <div class="file-name-text" :title="item.name">{{ item.name }}</div>
                <div class="file-row-meta" v-if="viewMode === 'list'">
                  <span>Pasta</span>
                  <span>-</span>
                  <span>{{ formatDate(item.lastModified) }}</span>
                </div>
              </div>
            </div>

            <!-- File Items -->
            <div 
              v-for="item in sortedFiles" 
              :key="item.path"
              :class="['glass-card file-item', viewMode === 'grid' ? 'file-card' : 'file-row', { selected: selectedItem?.path === item.path }]"
              @click="selectItem(item)"
              @dblclick="downloadFile(item)"
            >
              <div class="file-icon-wrapper">
                <component :is="getFileIcon(item)" class="w-10 h-10" />
              </div>
              <div class="file-details">
                <div class="file-name-text" :title="item.name">{{ item.name }}</div>
                <div class="file-row-meta" v-if="viewMode === 'list'">
                  <span>{{ getExtension(item.name).toUpperCase() || 'Arquivo' }}</span>
                  <span>{{ formatBytes(item.size) }}</span>
                  <span>{{ formatDate(item.lastModified) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Slide-in Details Drawer -->
    <div :class="['details-drawer glass-panel', { open: showDetails }]">
      <div class="drawer-header">
        <h2>Detalhes do Arquivo</h2>
        <button class="btn btn-icon" @click="showDetails = false">
          <XIcon class="w-4 h-4" />
        </button>
      </div>

      <div class="drawer-content" v-if="selectedItem">
        <div class="drawer-preview-box">
          <component :is="getFileIcon(selectedItem)" class="w-16 h-16 text-cyan" />
        </div>

        <div class="detail-info-list">
          <div class="info-group">
            <label>Nome</label>
            <div class="info-value text-wrap">{{ selectedItem.name }}</div>
          </div>
          <div class="info-group">
            <label>Caminho</label>
            <div class="info-value text-wrap">{{ selectedItem.path }}</div>
          </div>
          <div class="info-group">
            <label>Tipo</label>
            <div class="info-value">{{ selectedItem.isDir ? 'Diretório' : (selectedItem.contentType || 'Desconhecido') }}</div>
          </div>
          <div class="info-group" v-if="!selectedItem.isDir">
            <label>Tamanho</label>
            <div class="info-value">{{ formatBytes(selectedItem.size) }}</div>
          </div>
          <div class="info-group">
            <label>Modificado em</label>
            <div class="info-value">{{ formatDate(selectedItem.lastModified) }}</div>
          </div>
        </div>

        <div class="drawer-actions">
          <button v-if="!selectedItem.isDir" class="btn btn-primary w-full justify-center" @click="downloadFile(selectedItem)">
            <DownloadIcon class="w-4 h-4" /> Download
          </button>
          <button v-if="selectedItem.isDir && clipboard" class="btn btn-primary w-full justify-center" @click="pasteIntoFolder">
            <ClipboardIcon class="w-4 h-4" /> Colar Aqui
          </button>
          <button class="btn w-full justify-center" @click="copyItem(selectedItem)">
            <CopyIcon class="w-4 h-4" /> Copiar
          </button>
          <button class="btn w-full justify-center" @click="cutItem(selectedItem)">
            <ScissorsIcon class="w-4 h-4" /> Mover
          </button>
          <button class="btn w-full justify-center" @click="openRenameModal">
            <Edit3Icon class="w-4 h-4" /> Renomear
          </button>
          <button class="btn btn-danger w-full justify-center" @click="deleteSelectedItem">
            <Trash2Icon class="w-4 h-4" /> Excluir
          </button>
        </div>
      </div>
    </div>

    <!-- Modal para Nova Pasta -->
    <div class="modal-backdrop" v-if="showNewFolderModal">
      <div class="modal glass-panel animate-fade-in">
        <h3>Nova Pasta</h3>
        <input 
          type="text" 
          placeholder="Nome da pasta" 
          v-model="newFolderName" 
          @keyup.enter="createFolder" 
          ref="newFolderInput"
          autofocus
        />
        <div class="modal-buttons">
          <button class="btn" @click="showNewFolderModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="createFolder" :disabled="!newFolderName">Criar</button>
        </div>
      </div>
    </div>

    <!-- Modal para Renomear -->
    <div class="modal-backdrop" v-if="showRenameModal">
      <div class="modal glass-panel animate-fade-in">
        <h3>Renomear Item</h3>
        <input 
          type="text" 
          placeholder="Novo nome" 
          v-model="renameTargetName" 
          @keyup.enter="renameItem" 
          ref="renameInput"
          autofocus
        />
        <div class="modal-buttons">
          <button class="btn" @click="showRenameModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="renameItem" :disabled="!renameTargetName">Renomear</button>
        </div>
      </div>
    </div>

    <!-- Active Transfers Floating Panel -->
    <div class="transfers-panel glass-panel" v-if="transfers.length > 0">
      <div class="transfers-header">
        <h4>Transferências Ativas</h4>
      </div>
      <div class="transfers-list">
        <div v-for="t in transfers" :key="t.id" class="transfer-item">
          <div class="transfer-info">
            <component :is="t.type === 'upload' ? UploadIcon : DownloadIcon" class="w-4 h-4 text-cyan" />
            <span class="transfer-name" :title="t.name">{{ t.name }}</span>
            <span class="transfer-percent">{{ t.progress }}%</span>
          </div>
          <div class="transfer-progress-bar">
            <div class="transfer-progress-fill" :style="{ width: t.progress + '%' }" :class="{ completed: t.completed }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toasts Notifications -->
    <div class="toast-container">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast glass-panel', toast.type]">
        <span>{{ toast.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  CloudIcon, SearchIcon, UploadIcon, FolderPlusIcon, RefreshCwIcon,
  HomeIcon, LayoutGridIcon, ListIcon, FolderIcon, FileIcon, 
  FileTextIcon, ImageIcon, FilmIcon, MusicIcon, XIcon, DownloadIcon,
  Edit3Icon, Trash2Icon, FolderOpenIcon, UserIcon, LogOutIcon,
  ClipboardIcon, CopyIcon, ScissorsIcon
} from '@lucide/vue';
import { webdav } from './services/webdav';

// Auth State
const loggedIn = ref(webdav.hasCredentials());
const username = ref(webdav.getUsername());
const loginUser = ref('');
const loginPass = ref('');
const authenticating = ref(false);

// App State
const currentPath = ref('/');
const items = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const activeCategory = ref('all');
const viewMode = ref('grid');
const sortBy = ref('name');

const selectedItem = ref(null);
const showDetails = ref(false);

const showNewFolderModal = ref(false);
const newFolderName = ref('');

const showRenameModal = ref(false);
const renameTargetName = ref('');

const toasts = ref([]);

// Active Transfers State
const transfers = ref([]);

const updateTransferProgress = (id, progress) => {
  const t = transfers.value.find(item => item.id === id);
  if (t) t.progress = progress;
};

const removeTransfer = (id) => {
  transfers.value = transfers.value.filter(item => item.id !== id);
};

const removeTransferAfterDelay = (id) => {
  const t = transfers.value.find(item => item.id === id);
  if (t) {
    t.progress = 100;
    t.completed = true;
  }
  setTimeout(() => {
    removeTransfer(id);
  }, 3000);
};

// Clipboard State for Copy/Cut/Paste
const clipboard = ref(null);

const copyItem = (item) => {
  clipboard.value = {
    path: item.path,
    name: item.name,
    isDir: item.isDir,
    operation: 'copy'
  };
  showToast(`Copiado: ${item.name}`, 'info');
};

const cutItem = (item) => {
  clipboard.value = {
    path: item.path,
    name: item.name,
    isDir: item.isDir,
    operation: 'cut'
  };
  showToast(`Recortado: ${item.name}`, 'info');
};

const pasteItem = async () => {
  if (!clipboard.value) return;
  
  const targetPath = `${currentPath.value}/${clipboard.value.name}`.replace(/\/+/g, '/');
  
  if (targetPath === clipboard.value.path) {
    showToast('O destino não pode ser idêntico à origem.', 'error');
    return;
  }
  
  try {
    if (clipboard.value.operation === 'copy') {
      showToast(`Copiando ${clipboard.value.name}...`, 'info');
      await webdav.copyItem(clipboard.value.path, targetPath);
      showToast('Item copiado com sucesso!', 'success');
    } else {
      showToast(`Movendo ${clipboard.value.name}...`, 'info');
      await webdav.renameItem(clipboard.value.path, targetPath);
      showToast('Item movido com sucesso!', 'success');
      clipboard.value = null; // Clear clipboard for cut operation
    }
    loadCurrentDirectory();
  } catch (err) {
    showToast(`Erro ao colar: ${err.message}`, 'error');
  }
};

const pasteIntoFolder = async () => {
  if (!clipboard.value || !selectedItem.value || !selectedItem.value.isDir) return;
  
  const targetPath = `${selectedItem.value.path}/${clipboard.value.name}`.replace(/\/+/g, '/');
  
  if (targetPath === clipboard.value.path) {
    showToast('O destino não pode ser idêntico à origem.', 'error');
    return;
  }
  
  try {
    if (clipboard.value.operation === 'copy') {
      showToast(`Copiando ${clipboard.value.name} para ${selectedItem.value.name}...`, 'info');
      await webdav.copyItem(clipboard.value.path, targetPath);
      showToast('Item copiado com sucesso!', 'success');
    } else {
      showToast(`Movendo ${clipboard.value.name} para ${selectedItem.value.name}...`, 'info');
      await webdav.renameItem(clipboard.value.path, targetPath);
      showToast('Item movido com sucesso!', 'success');
      clipboard.value = null; // Clear clipboard for cut operation
    }
    showDetails.value = false;
    selectedItem.value = null;
    loadCurrentDirectory();
  } catch (err) {
    showToast(`Erro ao colar: ${err.message}`, 'error');
  }
};

// Categories Definition
const categories = [
  { id: 'all', name: 'Todos os Arquivos', icon: FolderOpenIcon },
  { id: 'folders', name: 'Pastas', icon: FolderIcon },
  { id: 'docs', name: 'Documentos', icon: FileTextIcon },
  { id: 'images', name: 'Imagens', icon: ImageIcon },
  { id: 'videos', name: 'Vídeos', icon: FilmIcon },
  { id: 'audio', name: 'Áudio', icon: MusicIcon }
];

// Computed path parts for breadcrumbs
const pathParts = computed(() => {
  return currentPath.value.split('/').filter(Boolean);
});

// File list computed metrics
const totalFiles = computed(() => items.value.filter(i => !i.isDir).length);
const totalFolders = computed(() => items.value.filter(i => i.isDir).length);
const totalSize = computed(() => items.value.reduce((acc, curr) => acc + (curr.size || 0), 0));

// Auth Logic
const handleLogin = async () => {
  if (!loginUser.value || !loginPass.value) return;
  authenticating.value = true;
  try {
    await webdav.authenticate(loginUser.value, loginPass.value);
    loggedIn.value = true;
    username.value = webdav.getUsername();
    showToast('Acesso concedido com sucesso!', 'success');
    loadCurrentDirectory();
  } catch (err) {
    showToast(err.message || 'Erro de autenticação', 'error');
  } finally {
    authenticating.value = false;
  }
};

const handleLogout = () => {
  webdav.clearCredentials();
  loggedIn.value = false;
  username.value = '';
  items.value = [];
  selectedItem.value = null;
  showDetails.value = false;
  showToast('Você saiu do sistema.', 'info');
};

// Navigation Methods
const navigateTo = (path) => {
  currentPath.value = path;
  selectedItem.value = null;
  showDetails.value = false;
  loadCurrentDirectory();
};

const navigateToIndex = (idx) => {
  const parts = pathParts.value.slice(0, idx + 1);
  navigateTo('/' + parts.join('/'));
};

const openDirectory = (path) => {
  navigateTo(path);
};

// Filter & Sort Logic
const filteredItems = computed(() => {
  let list = items.value;

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(item => item.name.toLowerCase().includes(query));
  }

  // Category filter
  if (activeCategory.value !== 'all') {
    if (activeCategory.value === 'folders') {
      list = list.filter(item => item.isDir);
    } else {
      list = list.filter(item => {
        if (item.isDir) return false;
        const ext = getExtension(item.name).toLowerCase();
        
        if (activeCategory.value === 'docs') {
          return ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'md', 'deb'].includes(ext);
        }
        if (activeCategory.value === 'images') {
          return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
        }
        if (activeCategory.value === 'videos') {
          return ['mp4', 'mkv', 'avi', 'mov'].includes(ext);
        }
        if (activeCategory.value === 'audio') {
          return ['mp3', 'wav', 'ogg', 'flac'].includes(ext);
        }
        return false;
      });
    }
  }

  // Sorting
  return [...list].sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy.value === 'size') {
      const sizeA = a.size || 0;
      const sizeB = b.size || 0;
      return sizeB - sizeA;
    }
    if (sortBy.value === 'date') {
      const dateA = new Date(a.lastModified || 0);
      const dateB = new Date(b.lastModified || 0);
      return dateB - dateA;
    }
    return 0;
  });
});

const sortedFolders = computed(() => filteredItems.value.filter(i => i.isDir));
const sortedFiles = computed(() => filteredItems.value.filter(i => !i.isDir));

// Count calculator for sidebar categories
const getCategoryCount = (catId) => {
  if (catId === 'all') return items.value.length;
  if (catId === 'folders') return totalFolders.value;
  
  return items.value.filter(item => {
    if (item.isDir) return false;
    const ext = getExtension(item.name).toLowerCase();
    if (catId === 'docs') return ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'md', 'deb'].includes(ext);
    if (catId === 'images') return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
    if (catId === 'videos') return ['mp4', 'mkv', 'avi', 'mov'].includes(ext);
    if (catId === 'audio') return ['mp3', 'wav', 'ogg', 'flac'].includes(ext);
    return false;
  }).length;
};

// Selection
const selectItem = (item) => {
  selectedItem.value = item;
  showDetails.value = true;
};

// Load content
const loadCurrentDirectory = async () => {
  if (!loggedIn.value) return;
  loading.value = true;
  try {
    items.value = await webdav.listFiles(currentPath.value);
  } catch (err) {
    showToast(`Erro ao carregar diretório: ${err.message}`, 'error');
  } finally {
    loading.value = false;
  }
};

// Create Folder
const createFolder = async () => {
  if (!newFolderName.value) return;
  try {
    await webdav.createFolder(currentPath.value, newFolderName.value);
    showToast('Pasta criada com sucesso!', 'success');
    showNewFolderModal.value = false;
    newFolderName.value = '';
    loadCurrentDirectory();
  } catch (err) {
    showToast(`Erro ao criar pasta: ${err.message}`, 'error');
  }
};

// Upload
const fileInput = ref(null);
const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFileUpload = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const transferId = Date.now() + '-ul-' + i;
    
    transfers.value.push({
      id: transferId,
      name: file.name,
      type: 'upload',
      progress: 0,
      completed: false
    });

    try {
      await webdav.uploadFile(currentPath.value, file, (progress) => {
        updateTransferProgress(transferId, progress);
      });
      removeTransferAfterDelay(transferId);
      showToast(`${file.name} enviado com sucesso!`, 'success');
    } catch (err) {
      removeTransfer(transferId);
      showToast(`Erro ao enviar ${file.name}: ${err.message}`, 'error');
    }
  }
  loadCurrentDirectory();
};

// Delete
const deleteSelectedItem = async () => {
  if (!selectedItem.value) return;
  if (!confirm(`Deseja realmente excluir "${selectedItem.value.name}"?`)) return;
  
  try {
    await webdav.deleteItem(selectedItem.value.path);
    showToast('Item excluído com sucesso!', 'success');
    showDetails.value = false;
    selectedItem.value = null;
    loadCurrentDirectory();
  } catch (err) {
    showToast(`Erro ao excluir item: ${err.message}`, 'error');
  }
};

// Rename
const openRenameModal = () => {
  if (!selectedItem.value) return;
  renameTargetName.value = selectedItem.value.name;
  showRenameModal.value = true;
};

const renameItem = async () => {
  if (!renameTargetName.value || !selectedItem.value) return;
  
  // Construct parent directory path from item path
  const parts = selectedItem.value.path.split('/').filter(Boolean);
  parts.pop(); // remove current name
  const parentPath = '/' + parts.join('/');
  const newPath = `${parentPath}/${renameTargetName.value}`.replace(/\/+/g, '/');

  try {
    await webdav.renameItem(selectedItem.value.path, newPath);
    showToast('Item renomeado com sucesso!', 'success');
    showRenameModal.value = false;
    showDetails.value = false;
    selectedItem.value = null;
    loadCurrentDirectory();
  } catch (err) {
    showToast(`Erro ao renomear item: ${err.message}`, 'error');
  }
};

// Download File
const downloadFile = async (item) => {
  if (item.isDir) return;
  
  const transferId = Date.now() + '-dl';
  transfers.value.push({
    id: transferId,
    name: item.name,
    type: 'download',
    progress: 0,
    completed: false
  });

  try {
    // Fetch file with credentials
    const response = await fetch(webdav.getFileUrl(item.path), {
      headers: {
        'Authorization': 'Basic ' + sessionStorage.getItem('webdav_auth')
      }
    });
    
    if (!response.ok) {
      throw new Error(`Código de status: ${response.status}`);
    }
    
    const contentLength = response.headers.get('Content-Length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    
    const reader = response.body.getReader();
    let receivedBytes = 0;
    const chunks = [];
    
    while(true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      receivedBytes += value.length;
      
      if (totalBytes > 0) {
        const progress = Math.round((receivedBytes / totalBytes) * 100);
        updateTransferProgress(transferId, progress);
      }
    }
    
    const blob = new Blob(chunks);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', item.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    removeTransferAfterDelay(transferId);
    showToast('Download concluído!', 'success');
  } catch (err) {
    removeTransfer(transferId);
    showToast(`Erro ao baixar arquivo: ${err.message}`, 'error');
  }
};

// Helpers
const getExtension = (filename) => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
};

const getFileIcon = (item) => {
  if (item.isDir) return FolderIcon;
  const ext = getExtension(item.name).toLowerCase();
  if (['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'md', 'deb'].includes(ext)) {
    return FileTextIcon;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
    return ImageIcon;
  }
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
    return FilmIcon;
  }
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    return MusicIcon;
  }
  return FileIcon;
};

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR');
};

// Toasts Notification helper
const showToast = (text, type = 'info') => {
  const id = Date.now();
  toasts.value.push({ id, text, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 4000);
};

// Lifecycle
onMounted(() => {
  if (loggedIn.value) {
    loadCurrentDirectory();
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  gap: 16px;
}

.top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px var(--accent-cyan-glow);
}

.logo-text h1 {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.logo-text h1 span {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  background-color: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--success);
}

.search-wrapper {
  position: relative;
  width: 300px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.search-wrapper input {
  width: 100%;
  padding-left: 38px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-glass);
  font-size: 0.875rem;
  font-weight: 600;
}

.main-layout {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 24px;
  flex-shrink: 0;
}

.sidebar-section h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-left: 8px;
}

.nav-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-list li:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.nav-list li.active {
  background: rgba(6, 182, 212, 0.1);
  color: var(--accent-cyan);
}

.nav-icon {
  width: 18px;
  height: 18px;
}

.count-badge {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 99px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.storage-overview {
  margin-top: auto;
}

.storage-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.storage-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.storage-bar {
  background: var(--bg-tertiary);
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
}

.storage-progress {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
  border-radius: 3px;
}

.storage-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.sidebar-footer {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border-glass);
  padding-top: 16px;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.toolbar-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
}

.toolbar-controls {
  display: flex;
  gap: 12px;
}

.sort-select {
  padding: 6px 12px;
  font-size: 0.8125rem;
}

.view-toggle {
  display: flex;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 2px;
}

.view-toggle button {
  border: none;
  background: transparent;
  padding: 6px;
  border-radius: 6px;
}

.view-toggle button.active {
  background: rgba(255, 255, 255, 0.1);
  color: var(--accent-cyan);
}

.files-container {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 60%;
  color: var(--text-secondary);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-glass);
  padding-bottom: 16px;
}

.drawer-preview-box {
  background: var(--bg-secondary);
  border: 1px dashed var(--border-glass);
  border-radius: 12px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
}

.detail-info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-group label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-top: 4px;
  word-break: break-all;
}

.text-wrap {
  word-wrap: break-word;
  white-space: pre-wrap;
}

.drawer-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  width: 90%;
  max-width: 400px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.modal input {
  width: 100%;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Toasts */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 300;
}

.toast {
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  min-width: 250px;
  max-width: 400px;
  animation: fadeIn 0.3s ease;
}

.toast.success {
  border-left: 4px solid var(--success);
  background: rgba(16, 185, 129, 0.1);
}

.toast.error {
  border-left: 4px solid var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

.toast.info {
  border-left: 4px solid var(--accent-cyan);
  background: rgba(6, 182, 212, 0.1);
}
</style>
