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

	for key, item := range catalog {
		if key == "" {
			return nil, fmt.Errorf("catalog entry has empty key")
		}
		if item.ID == "" {
			return nil, fmt.Errorf("catalog item %q has empty ID", key)
		}
		if key != item.ID {
			return nil, fmt.Errorf("catalog key %q does not match item ID %q", key, item.ID)
		}
		if item.Price <= 0 {
			return nil, fmt.Errorf("catalog item %q has invalid price: %d", key, item.Price)
		}
		if item.Currency != "soft" && item.Currency != "premium" {
			return nil, fmt.Errorf("catalog item %q has invalid currency: %q", key, item.Currency)
		}
		if item.Type == "" {
			return nil, fmt.Errorf("catalog item %q has empty type", key)
		}
	}

	return catalog, nil
}
