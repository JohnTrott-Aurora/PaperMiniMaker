package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/glebarez/go-sqlite"
)

func TestInitDatabase(t *testing.T) {
	// Setup temporary database directory
	tempDir, err := os.MkdirTemp("", "pmm_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Direct sql connection to a temporary file
	dbPath := filepath.Join(tempDir, "test_paperminimaker.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("Failed to open test sqlite database: %v", err)
	}
	defer db.Close()

	// Run table creations
	queries := []string{
		`CREATE TABLE IF NOT EXISTS creatures (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			size TEXT NOT NULL,
			orientation TEXT NOT NULL,
			image_data TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS recent_projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			file_path TEXT NOT NULL UNIQUE,
			last_opened DATETIME NOT NULL
		);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			t.Fatalf("Failed to execute table creation: %v", err)
		}
	}

	// Verify tables are created
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table'")
	if err != nil {
		t.Fatalf("Failed to query tables: %v", err)
	}
	defer rows.Close()

	tableNames := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("Failed to scan table name: %v", err)
		}
		tableNames[name] = true
	}

	if !tableNames["creatures"] {
		t.Error("Expected table 'creatures' to exist")
	}
	if !tableNames["recent_projects"] {
		t.Error("Expected table 'recent_projects' to exist")
	}
}

func TestLibraryDatabaseOperations(t *testing.T) {
	// Create SQLite in memory for ultra-fast, isolated testing
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory sqlite database: %v", err)
	}
	defer db.Close()

	// Initialize tables
	_, err = db.Exec(`CREATE TABLE creatures (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		size TEXT NOT NULL,
		orientation TEXT NOT NULL,
		image_data TEXT NOT NULL
	);`)
	if err != nil {
		t.Fatalf("Failed to create table: %v", err)
	}

	appDB := &Database{db: db}

	// 1. Add Library Creature
	id, err := appDB.AddLibraryCreature("Dragon", "Large", "vertical", "data:image/png;base64,...")
	if err != nil {
		t.Fatalf("AddLibraryCreature failed: %v", err)
	}
	if id != 1 {
		t.Errorf("Expected inserted ID to be 1, got %d", id)
	}

	// 2. Get Library Creatures
	creatures, err := appDB.GetLibraryCreatures()
	if err != nil {
		t.Fatalf("GetLibraryCreatures failed: %v", err)
	}
	if len(creatures) != 1 {
		t.Errorf("Expected 1 creature, got %d", len(creatures))
	}
	if creatures[0].Name != "Dragon" || creatures[0].Size != "Large" {
		t.Errorf("Unexpected creature data: %+v", creatures[0])
	}

	// 3. Delete Library Creature
	err = appDB.DeleteLibraryCreature(id)
	if err != nil {
		t.Fatalf("DeleteLibraryCreature failed: %v", err)
	}

	creatures, err = appDB.GetLibraryCreatures()
	if err != nil {
		t.Fatalf("GetLibraryCreatures post-delete failed: %v", err)
	}
	if len(creatures) != 0 {
		t.Errorf("Expected 0 creatures after deletion, got %d", len(creatures))
	}
}
