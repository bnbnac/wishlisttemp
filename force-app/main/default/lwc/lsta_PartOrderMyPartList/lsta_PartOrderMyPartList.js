import { LightningElement, api } from 'lwc';

export default class Lsta_PartOrderMyPartList extends LightningElement {

    showCreateListModal;
    showEditListModal;
    showAddPartModal;
    showAddToWishlistModal;
    showUploadSection;
    displayNoData;

    orderItems = [];

    selectedOrderRowKeys = []; // selected rows (by key-field)

    orderItems = [
        { salesStatus: 'In Stock', partNo: '20021224', oldPartNumber: 'A1280240', partName: 'NUT-HEX 2 TY-S305040013', qty: 10, unitPrice: '$1,025,761.00', billedAmount: '$1,025,761.00', latestOrderDate: '2023-10-01', latestOrderQuantity: 5, registrationDate: '2023-01-15', modelName: 'XU6158, XU6163, XU6168, XU5055, XU5065, XU6158, XU6168, XU6158, XU6168, XU5000 ALL', notes: 'Urgent', remark: 'First order' },
    ];

    columns = [
        { label: 'Sales Status', fieldName: 'salesStatus', initialWidth: 140 },
        { label: 'Part No', fieldName: 'partNo', initialWidth: 120 },
        { label: 'Old Part Number', fieldName: 'oldPartNumber', initialWidth: 150 },
        { label: 'Part Name', fieldName: 'partName', initialWidth: 200 },
        { label: 'Qty', fieldName: 'qty', type: 'number', initialWidth: 105 },
        { label: 'Unit Price', fieldName: 'unitPrice', initialWidth: 135 },
        { label: 'Billed Amount', fieldName: 'billedAmount', type: 'currency', initialWidth: 150 },
        { label: 'Latest Order Date', fieldName: 'latestOrderDate', type: 'date', initialWidth: 160 },
        { label: 'Latest Order Quantity', fieldName: 'latestOrderQuantity', type: 'number', initialWidth: 185 },
        { label: 'Initial Wishlist Registration Date', fieldName: 'registrationDate', type: 'date', initialWidth: 250 },
        { label: 'Model Name', fieldName: 'modelName', initialWidth: 300 },
        { label: 'Notes', fieldName: 'notes', initialWidth: 110 },
        { label: 'Remark', fieldName: 'remark', initialWidth: 130 }
    ];

    handleOrderRowSelection(event) {};

    // 필요없을듯
    handleRowAction(event) {};




    handleMenuSelect(event) {
        const selected = event.detail.value;

        switch (selected) {
            case 'create':
                console.log('create');
                this.showCreateListModal = true;
                break;
            case 'clear':
                console.log('clear');
                this.handleClickClearList();
                break;
            case 'delete':
                console.log('delete');
                this.handleClickDeleteList();
                break;
            case 'edit':
                console.log('edit');
                this.showEditListModal = true;
                break;
            default:
        }
    }






    async handleClickAddPart(event) {
            console.log('async handleClickAddPart');
        try {
            this.isLoading = true;
            // 파트 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

    async handleClickDeletePart(event) {
            console.log('async handleClickDeletePart');
        try {
            this.isLoading = true;
            // 선택 행 검증 → 확인 모달 → 삭제 로직
        } finally {
            this.isLoading = false;
        }
    }

    handleClickUploadCsv(event) {
            console.log('handleClickUploadCsv(event');
        // 실제 업로드는 lightning-file-upload를 사용 권장
        // 여기서는 업로드 섹션 열기/모달 오픈 트리거
    }

    handleClickDownloadCsvForm(event) {
            console.log('handleClickDownloadCsvForm(event');
        // 서버에서 템플릿 생성/다운로드 트리거
    }

    async handleClickAddToWishlist(event) {
            console.log('async handleClickAddToWishlist');
        try {
            this.isLoading = true;
            // 위시리스트 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

    handleClickPrint(event) {
            console.log('handleClickPrint(event');
        // 인쇄 전용 레이아웃 팝업 또는 window.print()
    }

    async handleClickAddToCart(event) {
            console.log('async handleClickAddToCart');
        try {
            this.isLoading = true;
            // 장바구니 추가 로직
        } finally {
            this.isLoading = false;
        }
    }

}