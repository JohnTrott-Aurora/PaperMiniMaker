package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
	db  *Database
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize the local SQLite database
	db, err := InitDatabase()
	if err != nil {
		runtime.LogError(ctx, fmt.Sprintf("Failed to initialize database: %v", err))
		return
	}
	a.db = db
	runtime.LogInfo(ctx, "Database initialized successfully")
}

// Close is called when the application closes (optional hook)
func (a *App) domReady(ctx context.Context) {
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// SelectLocalImage opens a file dialog to choose an image and returns it as a base64 data URL
func (a *App) SelectLocalImage() (string, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Creature Image",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Image Files (*.png; *.jpg; *.jpeg; *.webp)",
				Pattern:     "*.png;*.jpg;*.jpeg;*.webp",
			},
		},
	})
	if err != nil {
		return "", err
	}
	if filePath == "" {
		return "", nil // User cancelled
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	ext := filepath.Ext(filePath)
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "image/png" // Fallback
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded), nil
}

// SaveProject saves the JSON string representation of a project to a selected .pmm file
func (a *App) SaveProject(projectJSON string) (string, error) {
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Project",
		DefaultFilename: "project.pmm",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "PaperMiniMaker Projects (*.pmm)",
				Pattern:     "*.pmm",
			},
		},
	})
	if err != nil {
		return "", err
	}
	if filePath == "" {
		return "", nil // User cancelled
	}

	err = os.WriteFile(filePath, []byte(projectJSON), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write project file: %w", err)
	}

	// Save to recent projects database
	if a.db != nil {
		name := filepath.Base(filePath)
		// Strip extension from display name
		if ext := filepath.Ext(name); ext != "" {
			name = name[:len(name)-len(ext)]
		}
		_ = a.db.AddRecentProject(name, filePath)
	}

	return filePath, nil
}

// LoadProject opens a file dialog to select a .pmm file and returns its content as a JSON string
func (a *App) LoadProject() (string, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Project",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "PaperMiniMaker Projects (*.pmm)",
				Pattern:     "*.pmm",
			},
		},
	})
	if err != nil {
		return "", err
	}
	if filePath == "" {
		return "", nil // User cancelled
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read project file: %w", err)
	}

	// Update recent projects database
	if a.db != nil {
		name := filepath.Base(filePath)
		if ext := filepath.Ext(name); ext != "" {
			name = name[:len(name)-len(ext)]
		}
		_ = a.db.AddRecentProject(name, filePath)
	}

	return string(data), nil
}

// LoadProjectFromPath loads a project's content directly from a path (e.g. from the recents list)
func (a *App) LoadProjectFromPath(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read project file: %w", err)
	}

	// Update recent projects database
	if a.db != nil {
		name := filepath.Base(filePath)
		if ext := filepath.Ext(name); ext != "" {
			name = name[:len(name)-len(ext)]
		}
		_ = a.db.AddRecentProject(name, filePath)
	}

	return string(data), nil
}

// SaveToLibrary adds a creature to the SQLite library
func (a *App) SaveToLibrary(name, size, orientation, imageData string) (int64, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not initialized")
	}
	return a.db.AddLibraryCreature(name, size, orientation, imageData)
}

// GetLibrary retrieves all creatures in the SQLite library
func (a *App) GetLibrary() ([]LibraryCreature, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.db.GetLibraryCreatures()
}

// DeleteFromLibrary removes a creature from the SQLite library
func (a *App) DeleteFromLibrary(id int64) error {
	if a.db == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.db.DeleteLibraryCreature(id)
}

// GetRecentProjects retrieves the list of recently opened projects
func (a *App) GetRecentProjects() ([]RecentProject, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.db.GetRecentProjects()
}
