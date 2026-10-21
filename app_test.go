package main

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/glebarez/go-sqlite"
)

type creatureTestPayload struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	IsNPC bool   `json:"isNPC"`
}

type projectTestPayload struct {
	Creatures             []creatureTestPayload `json:"creatures"`
	PageFormat            string                `json:"pageFormat"`
	AllowAutoRotation     bool                  `json:"allowAutoRotation"`
	IncludeCreatureNumber bool                  `json:"includeCreatureNumber"`
}

func TestLoadProjectFromPathWithNPC(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "pmm_app_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// In-memory or temp DB for App
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open sqlite: %v", err)
	}
	defer sqlDB.Close()

	_, err = sqlDB.Exec(`CREATE TABLE recent_projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		file_path TEXT NOT NULL UNIQUE,
		last_opened DATETIME NOT NULL
	);`)
	if err != nil {
		t.Fatalf("Failed to create table: %v", err)
	}

	app := &App{
		db: &Database{db: sqlDB},
	}

	// 1. Create a project file with individual creature NPC flags
	projectFilePath := filepath.Join(tempDir, "npc_test.pmm")
	expectedPayload := projectTestPayload{
		Creatures: []creatureTestPayload{
			{ID: "c1", Name: "Goblin", IsNPC: false},
			{ID: "c2", Name: "Sildar Hallwinter", IsNPC: true},
		},
		PageFormat:            "a4",
		AllowAutoRotation:     true,
		IncludeCreatureNumber: true,
	}

	data, err := json.Marshal(expectedPayload)
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	if err := os.WriteFile(projectFilePath, data, 0644); err != nil {
		t.Fatalf("Failed to write project file: %v", err)
	}

	// 2. Load using LoadProjectFromPath
	loadedContent, err := app.LoadProjectFromPath(projectFilePath)
	if err != nil {
		t.Fatalf("LoadProjectFromPath failed: %v", err)
	}

	var parsed projectTestPayload
	if err := json.Unmarshal([]byte(loadedContent), &parsed); err != nil {
		t.Fatalf("Failed to unmarshal loaded project: %v", err)
	}

	if len(parsed.Creatures) != 2 {
		t.Fatalf("Expected 2 creatures, got %d", len(parsed.Creatures))
	}
	if parsed.Creatures[0].IsNPC {
		t.Errorf("Expected creature 0 IsNPC to be false")
	}
	if !parsed.Creatures[1].IsNPC {
		t.Errorf("Expected creature 1 IsNPC to be true")
	}
	if parsed.PageFormat != "a4" {
		t.Errorf("Expected PageFormat 'a4', got %v", parsed.PageFormat)
	}

	// 3. Verify it was added to recents
	recents, err := app.GetRecentProjects()
	if err != nil {
		t.Fatalf("GetRecentProjects failed: %v", err)
	}
	if len(recents) != 1 {
		t.Fatalf("Expected 1 recent project, got %d", len(recents))
	}
	if recents[0].Name != "npc_test" {
		t.Errorf("Expected recent project name 'npc_test', got '%s'", recents[0].Name)
	}
}
