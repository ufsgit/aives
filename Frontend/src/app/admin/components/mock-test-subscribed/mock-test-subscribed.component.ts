import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { student_Service } from '../../services/student.Service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mock-test-subscribed',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mock-test-subscribed.component.html',
  styleUrls: ['./mock-test-subscribed.component.scss']
})
export class MockTestSubscribedComponent implements OnInit {
  student_Service_ = inject(student_Service);
  
  packages: any[] = [];
  filteredPackages: any[] = [];
  isLoading = true;
  searchTerm = '';

  // Form State
  showForm = false;
  isEditing = false;
  currentPackage: any = { Package_ID: 0, Package_Name: '' };
  isSaving = false;

  ngOnInit(): void {
    this.loadPackages();
  }

  loadPackages(): void {
    this.isLoading = true;
    this.student_Service_.Get_MockTestPackages().subscribe({
      next: (res: any) => {
        // Assume res is an array containing another array in res[0] due to multiple SP returns, or just res directly
        let data = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        this.packages = data || [];
        this.filteredPackages = [...this.packages];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching packages', err);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load packages.', 'error');
      }
    });
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredPackages = this.packages.filter(p => 
      (p.Package_Name?.toLowerCase().includes(term) || false)
    );
  }

  openCreateForm(): void {
    this.isEditing = false;
    this.currentPackage = { Package_ID: 0, Package_Name: '' };
    this.showForm = true;
  }

  editPackage(pkg: any): void {
    this.isEditing = true;
    this.currentPackage = { ...pkg };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.currentPackage = { Package_ID: 0, Package_Name: '' };
  }

  savePackage(): void {
    if (!this.currentPackage.Package_Name?.trim()) {
      Swal.fire('Warning', 'Package Name is required.', 'warning');
      return;
    }

    this.isSaving = true;
    this.student_Service_.Save_MockTestPackage(this.currentPackage).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        Swal.fire('Success', 'Package saved successfully.', 'success');
        this.closeForm();
        this.loadPackages();
      },
      error: (err) => {
        console.error(err);
        this.isSaving = false;
        Swal.fire('Error', 'Failed to save package.', 'error');
      }
    });
  }

  deletePackage(pkg: any): void {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.student_Service_.Delete_MockTestPackage(pkg.Package_ID).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'Package has been deleted.', 'success');
            this.loadPackages();
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'Failed to delete package.', 'error');
          }
        });
      }
    });
  }
}
