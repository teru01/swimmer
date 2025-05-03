/**
 * Formats the time elapsed since a given date string into a human-readable "Age" format.
 * e.g., "5m", "2h", "3d"
 * @param dateString ISO 8601 date string (e.g., "2023-10-27T10:00:00Z")
 * @returns Formatted age string or empty string if input is invalid.
 */
export const formatAge = (dateString: string | undefined): string => {
  if (!dateString) {
    return '';
  }
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  } catch (error) {
    console.error('Error formatting age:', error);
    return '';
  }
};
