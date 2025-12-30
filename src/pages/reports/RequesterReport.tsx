import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Users,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ===================================================================
// TYPES
// ===================================================================
interface RequesterStats {
  id: string;
  name: string;
  department: string | null;
  totalRequests: number;
  totalItems: number;
  marble: number;
  tile: number;
  terrazzo: number;
  quartz: number;
}

type SortField = 'name' | 'totalItems' | 'marble' | 'tile' | 'terrazzo' | 'quartz';
type SortDirection = 'asc' | 'desc';

// ===================================================================
// DATA FETCHING HOOK
// ===================================================================
function useRequesterReport() {
  return useQuery({
    queryKey: ['requester-report'],
    queryFn: async () => {
      // Fetch all requests with their items and creator info
      const { data: requests, error: reqError } = await supabase
        .from('requests')
        .select(`
          id,
          created_by,
          product_type,
          quantity,
          item_count,
          creator:profiles!created_by (
            id,
            full_name,
            department
          )
        `)
        .not('status', 'eq', 'draft'); // Exclude drafts

      if (reqError) throw reqError;

      // Fetch all request items for multi-product requests
      const { data: items, error: itemsError } = await supabase
        .from('request_items')
        .select('request_id, product_type, quantity');

      if (itemsError) throw itemsError;

      // Create a map of request_id -> items
      const itemsMap = new Map<string, { product_type: string; quantity: number }[]>();
      items?.forEach((item) => {
        const existing = itemsMap.get(item.request_id) || [];
        existing.push({ product_type: item.product_type, quantity: item.quantity });
        itemsMap.set(item.request_id, existing);
      });

      // Aggregate by requester
      const requesterMap = new Map<string, RequesterStats>();

      requests?.forEach((request) => {
        // Handle the creator field which comes as an object from the join
        const creatorData = request.creator as unknown;
        if (!creatorData || typeof creatorData !== 'object') return;
        const creator = creatorData as { id: string; full_name: string; department: string | null };
        if (!creator.id) return;

        const requesterId = creator.id;
        const existing = requesterMap.get(requesterId) || {
          id: requesterId,
          name: creator.full_name,
          department: creator.department,
          totalRequests: 0,
          totalItems: 0,
          marble: 0,
          tile: 0,
          terrazzo: 0,
          quartz: 0,
        };

        existing.totalRequests += 1;

        // Check if this request has items in request_items table
        const requestItems = itemsMap.get(request.id);

        if (requestItems && requestItems.length > 0) {
          // Multi-product: aggregate from items
          requestItems.forEach((item) => {
            existing.totalItems += item.quantity;
            const productType = item.product_type.toLowerCase() as 'marble' | 'tile' | 'terrazzo' | 'quartz';
            if (existing[productType] !== undefined) {
              existing[productType] += item.quantity;
            }
          });
        } else {
          // Legacy single-product request
          existing.totalItems += request.quantity || 0;
          const productType = (request.product_type || '').toLowerCase() as 'marble' | 'tile' | 'terrazzo' | 'quartz';
          if (existing[productType] !== undefined) {
            existing[productType] += request.quantity || 0;
          }
        }

        requesterMap.set(requesterId, existing);
      });

      return Array.from(requesterMap.values());
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ===================================================================
// MAIN COMPONENT
// ===================================================================
export default function RequesterReport() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { data: stats, isLoading, error } = useRequesterReport();

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('totalItems');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sorted data
  const sortedData = useMemo(() => {
    if (!stats) return [];

    return [...stats].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a[sortField] - b[sortField];
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [stats, sortField, sortDirection]);

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="h-4 w-4 text-primary" />
    );
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!sortedData.length) return;

    // Prepare data for Excel
    const excelData = sortedData.map((row, index) => ({
      'S.No': index + 1,
      'Requester Name': row.name,
      'Department': row.department || 'N/A',
      'Total Requests': row.totalRequests,
      'Total Items': row.totalItems,
      'Marble': row.marble,
      'Tile': row.tile,
      'Terrazzo': row.terrazzo,
      'Quartz': row.quartz,
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 25 }, // Name
      { wch: 15 }, // Department
      { wch: 14 }, // Total Requests
      { wch: 12 }, // Total Items
      { wch: 10 }, // Marble
      { wch: 10 }, // Tile
      { wch: 10 }, // Terrazzo
      { wch: 10 }, // Quartz
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Requester Report');

    // Generate filename with date
    const today = new Date().toISOString().split('T')[0];
    const filename = `Requester_Report_${today}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };

  // Calculate totals
  const totals = useMemo(() => {
    if (!stats) return { totalItems: 0, marble: 0, tile: 0, terrazzo: 0, quartz: 0 };
    return stats.reduce(
      (acc, row) => ({
        totalItems: acc.totalItems + row.totalItems,
        marble: acc.marble + row.marble,
        tile: acc.tile + row.tile,
        terrazzo: acc.terrazzo + row.terrazzo,
        quartz: acc.quartz + row.quartz,
      }),
      { totalItems: 0, marble: 0, tile: 0, terrazzo: 0, quartz: 0 }
    );
  }, [stats]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/?tab=reports')}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Reports</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Requester Wise Report
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:inline">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="col-span-2 sm:col-span-1 border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Requesters</p>
                  <p className="text-2xl font-bold">{stats?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="text-xl font-bold text-emerald-600">{totals.totalItems}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Marble</p>
              <p className="text-xl font-bold text-indigo-600">{totals.marble}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tile</p>
              <p className="text-xl font-bold text-teal-600">{totals.tile}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Terrazzo</p>
              <p className="text-xl font-bold text-amber-600">{totals.terrazzo}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-pink-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Quartz</p>
              <p className="text-xl font-bold text-pink-600">{totals.quartz}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <div>
              <CardTitle className="text-lg">Sample Consumption by Requester</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Click column headers to sort. Default: highest consumption first.
              </p>
            </div>
            <Button
              onClick={exportToExcel}
              disabled={!stats?.length}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading report data...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                <p>Failed to load report data. Please try again.</p>
              </div>
            ) : sortedData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No data available for this report.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16 text-center">#</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Requester Name
                          {getSortIcon('name')}
                        </div>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => handleSort('totalItems')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Total Items
                          {getSortIcon('totalItems')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-muted/80 transition-colors hidden sm:table-cell"
                        onClick={() => handleSort('marble')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Marble
                          {getSortIcon('marble')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-muted/80 transition-colors hidden sm:table-cell"
                        onClick={() => handleSort('tile')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Tile
                          {getSortIcon('tile')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-muted/80 transition-colors hidden lg:table-cell"
                        onClick={() => handleSort('terrazzo')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Terrazzo
                          {getSortIcon('terrazzo')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-muted/80 transition-colors hidden lg:table-cell"
                        onClick={() => handleSort('quartz')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Quartz
                          {getSortIcon('quartz')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((row, index) => (
                      <TableRow key={row.id} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground md:hidden capitalize">
                            {row.department || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="capitalize">
                            {row.department || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-emerald-600">{row.totalItems}</span>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className={row.marble > 0 ? 'font-medium text-indigo-600' : 'text-muted-foreground'}>
                            {row.marble}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className={row.tile > 0 ? 'font-medium text-teal-600' : 'text-muted-foreground'}>
                            {row.tile}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          <span className={row.terrazzo > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground'}>
                            {row.terrazzo}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          <span className={row.quartz > 0 ? 'font-medium text-pink-600' : 'text-muted-foreground'}>
                            {row.quartz}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold border-t-2">
                      <TableCell className="text-center">-</TableCell>
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="hidden md:table-cell">-</TableCell>
                      <TableCell className="text-center text-emerald-700">{totals.totalItems}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell text-indigo-700">{totals.marble}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell text-teal-700">{totals.tile}</TableCell>
                      <TableCell className="text-center hidden lg:table-cell text-amber-700">{totals.terrazzo}</TableCell>
                      <TableCell className="text-center hidden lg:table-cell text-pink-700">{totals.quartz}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile Breakdown Info */}
        <div className="sm:hidden text-xs text-muted-foreground text-center">
          <p>Scroll table horizontally or rotate device to see all columns.</p>
          <p className="mt-1">Export to Excel for complete data.</p>
        </div>
      </main>
    </div>
  );
}
