package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/glebarez/go-sqlite"
)

type Database struct {
	db *sql.DB
}

type LibraryCreature struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Size        string `json:"size"`        // "Small", "Medium", "Large", "Huge", "Gargantuan"
	Orientation string `json:"orientation"` // "vertical", "horizontal"
	ImageData   string `json:"imageData"`   // Base64 image data
}

type RecentProject struct {
	ID         int64     `json:"id"`
	Name       string    `json:"name"`
	FilePath   string    `json:"filePath"`
	LastOpened time.Time `json:"lastOpened"`
}

// InitDatabase initializes the SQLite database in the user's config directory
func InitDatabase() (*Database, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}

	appDir := filepath.Join(configDir, "PaperMiniMaker")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create app config directory: %v", err)
	}

	dbPath := filepath.Join(appDir, "paperminimaker.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %v", err)
	}

	// Create tables if they don't exist
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
			db.Close()
			return nil, fmt.Errorf("failed to execute table creation query: %v", err)
		}
	}

	return &Database{db: db}, nil
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

// AddLibraryCreature saves a creature to the local library database
func (d *Database) AddLibraryCreature(name, size, orientation, imageData string) (int64, error) {
	query := `INSERT INTO creatures (name, size, orientation, image_data) VALUES (?, ?, ?, ?)`
	res, err := d.db.Exec(query, name, size, orientation, imageData)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// GetLibraryCreatures retrieves all saved creatures in the library
func (d *Database) GetLibraryCreatures() ([]LibraryCreature, error) {
	query := `SELECT id, name, size, orientation, image_data FROM creatures ORDER BY name ASC`
	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	creatures := []LibraryCreature{}
	for rows.Next() {
		var c LibraryCreature
		if err := rows.Scan(&c.ID, &c.Name, &c.Size, &c.Orientation, &c.ImageData); err != nil {
			return nil, err
		}
		creatures = append(creatures, c)
	}
	return creatures, nil
}

// DeleteLibraryCreature removes a creature from the library database
func (d *Database) DeleteLibraryCreature(id int64) error {
	query := `DELETE FROM creatures WHERE id = ?`
	_, err := d.db.Exec(query, id)
	return err
}

// AddRecentProject registers or updates a project in the recent projects list
func (d *Database) AddRecentProject(name, filePath string) error {
	query := `INSERT INTO recent_projects (name, file_path, last_opened) 
	          VALUES (?, ?, ?) 
	          ON CONFLICT(file_path) DO UPDATE SET 
	          name = excluded.name, 
	          last_opened = excluded.last_opened`
	_, err := d.db.Exec(query, name, filePath, time.Now())
	return err
}

// GetRecentProjects retrieves the list of recently opened projects
func (d *Database) GetRecentProjects() ([]RecentProject, error) {
	query := `SELECT id, name, file_path, last_opened FROM recent_projects ORDER BY last_opened DESC LIMIT 10`
	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := []RecentProject{}
	for rows.Next() {
		var p RecentProject
		if err := rows.Scan(&p.ID, &p.Name, &p.FilePath, &p.LastOpened); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}
