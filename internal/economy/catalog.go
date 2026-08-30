package economy

import (
	"encoding/json"
	"fmt"
	"os"
)

type CatalogItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Price       int64  `json:"price"`
	Currency    string `json:"currency"`
	Type        string `json:"type"`
}

func LoadCatalog(path string) (map[string]CatalogItem, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read catalog file: %w", err)
	}

	var catalog map[string]CatalogItem
	if err := json.Unmarshal(data, &catalog); err != nil {
		return nil, fmt.Errorf("failed to parse catalog JSON: %w", err)
	}

	return catalog, nil
}
