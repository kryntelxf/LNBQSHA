package player

type PlayerState struct {
	UserID          string `json:"userId"`
	DisplayName     string `json:"displayName"`
	AvatarURL       string `json:"avatarUrl"`
	Bio             string `json:"bio"`
	Level           int    `json:"level"`
	XP              int    `json:"xp"`
	Status          string `json:"status"`
	CurrentActivity string `json:"currentActivity"`
	LastSeen        int64  `json:"lastSeen"`
	CreatedAt       int64  `json:"createdAt"`
	UpdatedAt       int64  `json:"updatedAt"`
}
